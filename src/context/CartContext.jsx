import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

const GUEST_STORAGE_KEY = "guest_cart";

export const CartProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartId, setCartId] = useState(null);

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
        products (
          id,
          name,
          price,
          brands (name),
          frame_shapes (name),
          frame_materials (name),
          product_images (image_url, is_primary)
        )
      `,
      )
      .eq("cart_id", currentCartId);

    if (error) throw error;

    return data.map((item) => ({
      id: item.product_id,
      name: item.products.name,
      price: item.unit_price,
      image:
        item.products.product_images?.find((img) => img.is_primary)
          ?.image_url || item.products.product_images?.[0]?.image_url,
      brand: item.products.brands?.name,
      shape: item.products.frame_shapes?.name,
      material: item.products.frame_materials?.name,
      quantity: item.quantity,
      selectedOptions: {
        color: item.selected_color || "",
        colorHex: item.selected_color_hex || "",
        coatings: item.selected_coatings || [],
      },
    }));
  };

  const saveDbCart = async (currentCartId, items) => {
    if (!currentCartId) return;

    if (items.length === 0) {
      await supabase.from("cart_items").delete().eq("cart_id", currentCartId);
      return;
    }

    const toUpsert = items.map((item) => ({
      cart_id: currentCartId,
      product_id: item.id,
      quantity: item.quantity,
      selected_color: item.selectedOptions?.color || null,
      selected_color_hex: item.selectedOptions?.colorHex || null,
      selected_coatings: item.selectedOptions?.coatings || [],
      unit_price: item.price,
    }));

    // FIXED: Changed to strict comma-separated list of database columns
    const { error } = await supabase.from("cart_items").upsert(toUpsert, {
      onConflict: "cart_id,product_id,selected_color,selected_color_hex",
    });

    if (error) throw error;
  };

  // ----- Guest to Database Cart Merging Handler -----
  const mergeGuestCartToDb = async (currentCartId) => {
    const guestItems = loadGuestCart();
    if (guestItems.length === 0) return;

    try {
      const toUpsert = guestItems.map((item) => ({
        cart_id: currentCartId,
        product_id: item.id,
        quantity: item.quantity,
        selected_color: item.selectedOptions?.color || null,
        selected_color_hex: item.selectedOptions?.colorHex || null,
        selected_coatings: item.selectedOptions?.coatings || [],
        unit_price: item.price,
      }));

      // FIXED: Changed to strict comma-separated list of database columns
      const { error } = await supabase.from("cart_items").upsert(toUpsert, {
        onConflict: "cart_id,product_id,selected_color,selected_color_hex",
      });

      if (error) throw error;

      // Wipe guest storage after successful database replication
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (err) {
      console.error("Failed to merge guest cart into user profile:", err);
    }
  };

  // ----- Explicit Clean Reset for Manual Logouts -----
  const resetCartOnLogout = useCallback(() => {
    setCartId(null);
    setCartItems(loadGuestCart());
  }, []);

  // ----- Effect when authentication state changes -----
  useEffect(() => {
    let isMounted = true;

    const initCart = async () => {
      if (authLoading) return;
      setLoading(true);
      try {
        if (user) {
          const newCartId = await fetchOrCreateCart(user.id);

          // 1. Merge items they selected while browsed anonymously
          await mergeGuestCartToDb(newCartId);

          // 2. Fetch fully consolidated cloud array
          const dbItems = await loadDbCart(newCartId);

          if (isMounted) {
            setCartId(newCartId);
            setCartItems(dbItems);
          }
        } else {
          // Automatic baseline switcher fallback
          if (isMounted) {
            setCartId(null);
            setCartItems(loadGuestCart());
          }
        }
      } catch (err) {
        console.error("Failed to load cart:", err);
      } finally {
        if (isMounted) setLoading(false);
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
      const incomingOptions = {
        color: selectedOptions.color || "",
        colorHex: selectedOptions.colorHex || "",
        coatings: selectedOptions.coatings || [],
      };

      setCartItems((prev) => {
        const existingIndex = prev.findIndex((item) => {
          const currentOptions = item.selectedOptions || {};
          return (
            item.id === product.id &&
            (currentOptions.color || "") === incomingOptions.color &&
            (currentOptions.colorHex || "") === incomingOptions.colorHex &&
            JSON.stringify(currentOptions.coatings || []) ===
              JSON.stringify(incomingOptions.coatings)
          );
        });

        let newItems;
        if (existingIndex !== -1) {
          newItems = prev.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        } else {
          newItems = [
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
        }

        if (user && cartId) {
          saveDbCart(cartId, newItems).catch(console.error);
        } else if (!user) {
          saveGuestCart(newItems);
        }
        return newItems;
      });
    },
    [user, cartId],
  );

  const removeFromCart = useCallback(
    (index) => {
      setCartItems((prev) => {
        const newItems = prev.filter((_, i) => i !== index);
        if (user && cartId) {
          saveDbCart(cartId, newItems).catch(console.error);
        } else if (!user) {
          saveGuestCart(newItems);
        }
        return newItems;
      });
    },
    [user, cartId],
  );

  const updateQuantity = useCallback(
    (index, newQuantity) => {
      if (newQuantity < 1) {
        removeFromCart(index);
        return;
      }
      setCartItems((prev) => {
        const newItems = prev.map((item, idx) =>
          idx === index ? { ...item, quantity: newQuantity } : item,
        );

        if (user && cartId) {
          saveDbCart(cartId, newItems).catch(console.error);
        } else if (!user) {
          saveGuestCart(newItems);
        }
        return newItems;
      });
    },
    [user, cartId, removeFromCart],
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    if (user && cartId) {
      saveDbCart(cartId, []).catch(console.error);
    } else if (!user) {
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
        resetCartOnLogout,
        totalItems,
        subtotal,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
