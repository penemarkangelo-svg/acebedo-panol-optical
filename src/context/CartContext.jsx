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
          product_images (image_url, is_primary),
          type
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
      brand:
        item.products.brands?.name ||
        (item.products.type === "accessory" ? "Accessory" : null),
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

  // Save database cart by deleting all existing items and inserting new ones
  const saveDbCart = async (currentCartId, items) => {
    if (!currentCartId) return;
    await supabase.from("cart_items").delete().eq("cart_id", currentCartId);
    if (items.length === 0) return;
    const toInsert = items.map((item) => ({
      cart_id: currentCartId,
      product_id: item.id,
      quantity: item.quantity,
      selected_color: item.selectedOptions?.color || null,
      selected_color_hex: item.selectedOptions?.colorHex || null,
      selected_coatings: item.selectedOptions?.coatings || [],
      unit_price: item.price,
    }));
    const { error } = await supabase.from("cart_items").insert(toInsert);
    if (error) throw error;
  };

  // ----- Effect when authentication state changes (with proper merging) -----
  useEffect(() => {
    let isMounted = true;
    const initCart = async () => {
      if (authLoading) return;
      setLoading(true);
      try {
        if (user) {
          // Logged in: load database cart
          const newCartId = await fetchOrCreateCart(user.id);
          let dbItems = await loadDbCart(newCartId);
          const guestItems = loadGuestCart();
          if (guestItems.length > 0) {
            // MERGE guest items into dbItems (combine quantities)
            const merged = [...dbItems];
            guestItems.forEach((guestItem) => {
              const existingIndex = merged.findIndex(
                (item) =>
                  item.id === guestItem.id &&
                  (item.selectedOptions?.color || "") ===
                    (guestItem.selectedOptions?.color || "") &&
                  JSON.stringify(item.selectedOptions?.coatings || []) ===
                    JSON.stringify(guestItem.selectedOptions?.coatings || []),
              );
              if (existingIndex !== -1) {
                merged[existingIndex].quantity += guestItem.quantity;
              } else {
                merged.push(guestItem);
              }
            });
            // Save merged cart to database
            await saveDbCart(newCartId, merged);
            dbItems = merged;
            // Clear guest cart after successful merge
            localStorage.removeItem(GUEST_STORAGE_KEY);
          }
          if (isMounted) {
            setCartId(newCartId);
            setCartItems(dbItems);
          }
        } else {
          // Guest: load from localStorage
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
      setCartItems((prev) => {
        const incomingOptions = {
          color: selectedOptions.color || "",
          colorHex: selectedOptions.colorHex || "",
          coatings: selectedOptions.coatings || [],
        };
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
        // Persist
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
        totalItems,
        subtotal,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
