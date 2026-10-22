import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

const GUEST_STORAGE_KEY = "guest_cart";

// Compare cart item configurations.
const areOptionsEqual = (opt1 = {}, opt2 = {}) => {
  const clean1 = opt1 || {};
  const clean2 = opt2 || {};

  return (
    clean1.productColorId === clean2.productColorId &&
    clean1.visionMode === clean2.visionMode &&
    clean1.lensType === clean2.lensType &&
    clean1.coatingId === clean2.coatingId &&
    clean1.lensPackage === clean2.lensPackage &&
    clean1.lensExtraCharge === clean2.lensExtraCharge &&
    JSON.stringify(clean1.coatings || []) ===
      JSON.stringify(clean2.coatings || []) &&
    JSON.stringify(clean1.prescription || null) ===
      JSON.stringify(clean2.prescription || null)
  );
};

export const CartProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cartId, setCartId] = useState(null);

  const lastSyncedItemsRef = useRef("");

  // ----- Guest cart helpers -----

  const loadGuestCart = () => {
    try {
      const saved = localStorage.getItem(GUEST_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to read guest cart:", error);
      return [];
    }
  };

  const saveGuestCart = (items) => {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(items));
  };

  // ----- Database cart helpers -----

  const fetchOrCreateCart = async (userId) => {
    const { data: existingCart, error: fetchError } =
      await supabase
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existingCart) {
      return existingCart.id;
    }

    const { data: newCart, error: insertError } =
      await supabase
        .from("carts")
        .insert({
          user_id: userId,
          status: "active",
        })
        .select("id")
        .single();

    if (!insertError && newCart) {
      return newCart.id;
    }

    // Another request may have created the active cart.
    if (insertError?.code === "23505") {
      const {
        data: existingCartAfterConflict,
        error: retryError,
      } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (retryError) {
        throw retryError;
      }

      return existingCartAfterConflict.id;
    }

    throw insertError;
  };

  const loadDbCart = async (currentCartId) => {
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        id,
        product_id,
        product_color_id,
        lens_type_id,
        coating_id,
        quantity,
        unit_price,
        extras,
        products (
          id,
          name,
          price,
          brands (name),
          frame_shape:frame_attributes!products_frame_shape_id_fkey (name),
          frame_material:frame_attributes!products_frame_material_id_fkey (name),
          product_images (image_url, is_primary, sort_order),
          type
        )
      `)
      .eq("cart_id", currentCartId);

    if (error) {
      throw error;
    }

    return (data || []).map((item) => {
      const product = item.products || {};

      const selectedOptions = {
        productColorId: item.product_color_id || null,
        lensType: item.lens_type_id || null,
        coatingId: item.coating_id || null,
        ...(item.extras || {}),
      };

      const images = [...(product.product_images || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );

      const primaryImage = images.find((image) => image.is_primary);

      return {
        id: item.product_id,
        name: product.name || "Unknown product",
        price: Number(item.unit_price) || 0,
        image:
          primaryImage?.image_url ||
          images[0]?.image_url ||
          "https://placehold.co/400x300?text=No+Image",
        brand:
          product.brands?.name ||
          (product.type === "accessory" ? "Accessory" : null),
        shape: product.frame_shape?.name || "",
        material: product.frame_material?.name || "",
        quantity: item.quantity,
        selectedOptions,
      };
    });
  };

  const saveDbCart = async (currentCartId, items) => {
    if (!currentCartId) {
      return;
    }

    // Preserve the existing replacement-based synchronization.
    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", currentCartId);

    if (deleteError) {
      throw deleteError;
    }

    if (items.length === 0) {
      return;
    }

    const toInsert = items.map((item) => ({
      cart_id: currentCartId,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,

      product_color_id:
        item.selectedOptions?.productColorId || null,

      lens_type_id: item.selectedOptions?.lensType || null,
      coating_id: item.selectedOptions?.coatingId || null,

      extras: {
        visionMode: item.selectedOptions?.visionMode || null,
        lensPackage: item.selectedOptions?.lensPackage || null,
        lensExtraCharge:
          item.selectedOptions?.lensExtraCharge || 0,
      },
    }));

    const { error } = await supabase
      .from("cart_items")
      .insert(toInsert);

    if (error) {
      throw error;
    }
  };

  // ----- Debounced database synchronization -----

  useEffect(() => {
    if (loading || !user || !cartId) {
      return;
    }

    const currentItemsStr = JSON.stringify(cartItems);

    if (currentItemsStr === lastSyncedItemsRef.current) {
      return;
    }

    setIsSyncing(true);

    const syncTimeout = setTimeout(async () => {
      try {
        await saveDbCart(cartId, cartItems);
        lastSyncedItemsRef.current = currentItemsStr;
      } catch (error) {
        console.error("Automated cart sync failed:", error);
      } finally {
        setIsSyncing(false);
      }
    }, 500);

    return () => clearTimeout(syncTimeout);
  }, [cartItems, user, cartId, loading]);

  // ----- Guest cart synchronization -----

  useEffect(() => {
    if (loading || user || cartId) {
      return;
    }

    try {
      saveGuestCart(cartItems);
    } catch (error) {
      console.error("Failed to save guest cart:", error);
    }
  }, [cartItems, user, loading, cartId]);

  // ----- Authentication synchronization -----

  useEffect(() => {
    let isMounted = true;

    const initCart = async () => {
      if (authLoading) {
        return;
      }

      setLoading(true);

      try {
        if (user) {
          const newCartId = await fetchOrCreateCart(user.id);
          let dbItems = await loadDbCart(newCartId);
          const guestItems = loadGuestCart();

          // Existing behavior: merge guest items into the account cart.
          // This is retained here to avoid changing unrelated behavior.
          if (guestItems.length > 0) {
            const merged = [...dbItems];

            guestItems.forEach((guestItem) => {
              const existingIndex = merged.findIndex(
                (item) =>
                  item.id === guestItem.id &&
                  areOptionsEqual(
                    item.selectedOptions,
                    guestItem.selectedOptions
                  )
              );

              if (existingIndex !== -1) {
                merged[existingIndex] = {
                  ...merged[existingIndex],
                  quantity:
                    merged[existingIndex].quantity +
                    guestItem.quantity,
                };
              } else {
                merged.push(guestItem);
              }
            });

            await saveDbCart(newCartId, merged);
            dbItems = merged;
            localStorage.removeItem(GUEST_STORAGE_KEY);
          }

          if (isMounted) {
            lastSyncedItemsRef.current = JSON.stringify(dbItems);
            setCartId(newCartId);
            setCartItems(dbItems);
          }
        } else {
          if (isMounted) {
            setCartId(null);
            setCartItems(loadGuestCart());
          }
        }
      } catch (error) {
        console.error("Failed to load cart properly:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initCart();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // ----- Cart operations -----

  const addToCart = useCallback(
    (product, quantity = 1, selectedOptions = {}) => {
      setCartItems((previous) => {
        const incomingOptions = { ...selectedOptions };

        const existingIndex = previous.findIndex(
          (item) =>
            item.id === product.id &&
            areOptionsEqual(
              item.selectedOptions,
              incomingOptions
            )
        );

        if (existingIndex !== -1) {
          return previous.map((item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                }
              : item
          );
        }

        return [
          ...previous,
          {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            brand: product.brand,
            shape: product.shape,
            material: product.material,
            quantity,
            selectedOptions: incomingOptions,
          },
        ];
      });
    },
    []
  );

  const removeFromCart = useCallback((index) => {
    setCartItems((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  }, []);

  const updateQuantity = useCallback(
    (index, newQuantity) => {
      if (newQuantity < 1) {
        removeFromCart(index);
        return;
      }

      setCartItems((previous) =>
        previous.map((item, itemIndex) =>
          itemIndex === index
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(async () => {
    setCartItems([]);

    if (user && cartId) {
      try {
        await saveDbCart(cartId, []);
        lastSyncedItemsRef.current = JSON.stringify([]);
      } catch (error) {
        console.error("Failed to clear database cart:", error);
        throw error;
      }
    } else if (!user) {
      saveGuestCart([]);
    }
  }, [user, cartId]);

  const totalItems = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        loading,
        isSyncing,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};