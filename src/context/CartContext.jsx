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

// ✨ HELPER: Safe option comparison independent of key sequencing
const areOptionsEqual = (opt1 = {}, opt2 = {}) => {
  const clean1 = opt1 || {};
  const clean2 = opt2 || {};
  return (
    clean1.color === clean2.color &&
    clean1.colorHex === clean2.colorHex &&
    clean1.visionMode === clean2.visionMode &&
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
    const saved = localStorage.getItem(GUEST_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  };
  const saveGuestCart = (items) => {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(items));
  };

  // ----- Database cart helpers -----
  const fetchOrCreateCart = async (userId) => {
    let { data: cart, error } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (!cart) {
      const { data: newCart, error: insertError } = await supabase
        .from("carts")
        .insert({ user_id: userId, status: "active" })
        .select()
        .single();
      if (insertError) throw insertError;
      cart = newCart;
    }
    return cart.id;
  };

  const loadDbCart = async (currentCartId) => {
    const { data, error } = await supabase
      .from("cart_items")
      .select(
        `
        id,
        product_id,
        quantity,
        selected_color,
        selected_color_hex,
        selected_coatings,
        unit_price,
        extras,
        products (
          id,
          name,
          price,
          brands (name),
          frame_shapes (name),
          frame_materials (name),
          product_images (image_url, is_primary),
          type
        )
      `,
      )
      .eq("cart_id", currentCartId);
    if (error) throw error;
    return data.map((item) => {
      const selectedOptions = {
        color: item.selected_color || "",
        colorHex: item.selected_color_hex || "",
        coatings: item.selected_coatings || [],
        ...(item.extras || {}),
      };
      return {
        id: item.product_id,
        name: item.products.name,
        price: item.unit_price,
        image:
          item.products.product_images?.find((img) => img.is_primary)
            ?.image_url || item.products.product_images?.[0]?.image_url,
        brand:
          item.products.brands?.name ||
          (item.products.type === "accessory" ? "Accessory" : null),
        shape: item.products.frame_shapes?.name,
        material: item.products.frame_materials?.name,
        quantity: item.quantity,
        selectedOptions,
      };
    });
  };

  const saveDbCart = async (currentCartId, items) => {
    if (!currentCartId) return;
    await supabase.from("cart_items").delete().eq("cart_id", currentCartId);
    if (items.length === 0) return;

    const toInsert = items.map((item) => ({
      cart_id: currentCartId,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      selected_color: item.selectedOptions?.color || "",
      selected_color_hex: item.selectedOptions?.colorHex || "",
      selected_coatings: item.selectedOptions?.coatings || [],
      extras: item.selectedOptions || {},
    }));

    const { error } = await supabase.from("cart_items").insert(toInsert);
    if (error) throw error;
  };

  // ----- Sync Controller Effect (Debounced Synchronization) -----
  useEffect(() => {
    if (loading || !user || !cartId) return;

    const currentItemsStr = JSON.stringify(cartItems);
    if (currentItemsStr === lastSyncedItemsRef.current) return;

    setIsSyncing(true);

    const syncTimeout = setTimeout(async () => {
      try {
        await saveDbCart(cartId, cartItems);
        lastSyncedItemsRef.current = currentItemsStr;
      } catch (err) {
        console.error("Automated cart sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }, 500);

    return () => clearTimeout(syncTimeout);
  }, [cartItems, user, cartId, loading]);

  // ----- Synchronous Guest Sync Controller -----
  useEffect(() => {
    // ✨ GUARDRAIL: If cartId exists, these are database items. Block them from saving to Guest storage!
    if (loading || user || cartId) return;
    saveGuestCart(cartItems);
  }, [cartItems, user, loading, cartId]);

  // ----- Authentication Synchronization Loop -----
  useEffect(() => {
    let isMounted = true;
    const initCart = async () => {
      if (authLoading) return;
      setLoading(true);
      try {
        if (user) {
          const newCartId = await fetchOrCreateCart(user.id);
          let dbItems = await loadDbCart(newCartId);
          const guestItems = loadGuestCart();

          if (guestItems.length > 0) {
            const merged = [...dbItems];
            guestItems.forEach((guestItem) => {
              // ✨ CHANGED: Used areOptionsEqual helper to ensure zero duplicate bugs
              const existingIndex = merged.findIndex(
                (item) =>
                  item.id === guestItem.id &&
                  areOptionsEqual(
                    item.selectedOptions,
                    guestItem.selectedOptions,
                  ),
              );
              if (existingIndex !== -1) {
                merged[existingIndex].quantity += guestItem.quantity;
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
      } catch (err) {
        console.error("Failed to load cart properly:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initCart();
    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  // ----- Decoupled Cart Operations -----
  const addToCart = useCallback(
    (product, quantity = 1, selectedOptions = {}) => {
      setCartItems((prev) => {
        const incomingOptions = { ...selectedOptions };
        // ✨ CHANGED: Swapped for areOptionsEqual verification
        const existingIndex = prev.findIndex(
          (item) =>
            item.id === product.id &&
            areOptionsEqual(item.selectedOptions, incomingOptions),
        );

        if (existingIndex !== -1) {
          return prev.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        }
        return [
          ...prev,
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
    [],
  );

  const removeFromCart = useCallback((index) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateQuantity = useCallback(
    (index, newQuantity) => {
      if (newQuantity < 1) {
        removeFromCart(index);
        return;
      }
      setCartItems((prev) =>
        prev.map((item, idx) =>
          idx === index ? { ...item, quantity: newQuantity } : item,
        ),
      );
    },
    [removeFromCart],
  );

  const clearCart = useCallback(async () => {
    // Clear local state immediately
    setCartItems([]);
    // If logged in, save empty cart to database immediately (skip debounce)
    if (user && cartId) {
      await saveDbCart(cartId, []);
      lastSyncedItemsRef.current = JSON.stringify([]);
    } else if (!user) {
      // Guest: clear localStorage
      saveGuestCart([]);
    }
  }, [user, cartId]);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
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
