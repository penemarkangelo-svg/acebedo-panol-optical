import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");

    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error("Failed to parse cart:", error);
        localStorage.removeItem("cart");
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // Add item to cart or increase quantity if same product + same options
  const addToCart = (product, quantity = 1, selectedOptions = {}) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.id === product.id &&
          JSON.stringify(item.selectedOptions) ===
            JSON.stringify(selectedOptions),
      );

      if (existingIndex !== -1) {
        const updated = [...prev];

        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };

        return updated;
      }

      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          image: product.image || product.product_images?.[0]?.image_url,
          brand: product.brand || "No brand",
          shape: product.shape || "Shape not specified",
          material: product.material || "Material not specified",
          quantity,
          selectedOptions,
        },
      ];
    });
  };

  // Remove item completely
  const removeFromCart = (index) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update quantity of an item
  const updateQuantity = (index, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(index);
      return;
    }

    setCartItems((prev) => {
      const updated = [...prev];

      updated[index] = {
        ...updated[index],
        quantity: newQuantity,
      };

      return updated;
    });
  };

  // Clear entire cart
  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem("cart");
  };

  // Compute totals
  const totalItems = cartItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
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
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
