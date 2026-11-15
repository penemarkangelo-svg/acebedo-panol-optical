BEGIN;
-- Treat the current eyeglasses catalog type as eyewear frames in reservation and pricing validation.
CREATE OR REPLACE FUNCTION public.create_checkout_order(p_cart_id integer, p_checkout_idempotency_key uuid, p_customer_name text, p_contact_email text, p_contact_number text, p_fulfillment_method text, p_delivery_address text DEFAULT NULL::text, p_delivery_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_auth_email text := NULLIF(btrim(auth.jwt() ->> 'email'), '');
  v_email text;
  v_cart public.carts%ROWTYPE;
  v_order_id integer;
  v_reservation_id uuid;
  v_ttl interval;
  v_shipping_fee numeric(10,2);
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item record;
  v_product_type text;
  v_product_price numeric(12,2);
  v_lens_price numeric(12,2);
  v_unit_price numeric(12,2);
  v_item_subtotal numeric(12,2);
  v_variant_count integer;
  v_stock integer;
  v_reserved integer;
  v_order_item_id integer;
  v_existing_reservation uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF p_cart_id IS NULL OR p_checkout_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Cart and idempotency key are required';
  END IF;
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF p_contact_email IS NOT NULL AND btrim(p_contact_email) <> ''
     AND btrim(p_contact_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Contact email is invalid';
  END IF;
  v_email := COALESCE(NULLIF(btrim(p_contact_email), ''), v_auth_email);
  IF v_email IS NULL OR v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'A valid contact email is required';
  END IF;
  IF p_fulfillment_method NOT IN ('pickup','delivery') THEN
    RAISE EXCEPTION 'Invalid fulfillment method';
  END IF;
  IF p_fulfillment_method = 'delivery'
     AND (p_delivery_address IS NULL OR btrim(p_delivery_address) = '') THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_checkout_idempotency_key::text, 0));

  SELECT o.id INTO v_order_id
  FROM public.orders o
  WHERE o.user_id = v_user_id
    AND o.checkout_idempotency_key = p_checkout_idempotency_key;
  IF v_order_id IS NOT NULL THEN
    SELECT r.id INTO v_existing_reservation
    FROM public.inventory_reservations r
    WHERE r.order_id = v_order_id
    ORDER BY r.created_at DESC
    LIMIT 1;
    RETURN jsonb_build_object('order_id',v_order_id,'reservation_id',v_existing_reservation,'idempotent_replay',true);
  END IF;

  SELECT * INTO v_cart
  FROM public.carts c
  WHERE c.id = p_cart_id
    AND c.user_id = v_user_id
    AND c.status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active customer cart not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cart_items ci WHERE ci.cart_id = p_cart_id) THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  SELECT cfg.fee_amount INTO v_shipping_fee
  FROM public.shipping_fee_config cfg
  WHERE cfg.fulfillment_method = p_fulfillment_method
    AND cfg.is_active
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active shipping configuration for fulfillment method';
  END IF;

  SELECT cfg.reservation_ttl INTO v_ttl
  FROM public.inventory_reservation_config cfg
  WHERE cfg.id IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory reservation configuration is missing';
  END IF;

  PERFORM p.id
  FROM public.products p
  JOIN public.cart_items ci ON ci.product_id = p.id
  WHERE ci.cart_id = p_cart_id
  ORDER BY p.id
  FOR UPDATE OF p;

  PERFORM pc.id
  FROM public.product_colors pc
  JOIN public.cart_items ci
    ON ci.product_id = pc.product_id AND ci.product_color_id = pc.id
  WHERE ci.cart_id = p_cart_id
  ORDER BY pc.product_id, pc.id
  FOR UPDATE OF pc;

  PERFORM lpm.id
  FROM public.lens_pricing_matrix lpm
  JOIN public.cart_items ci ON ci.lens_type_id=lpm.lens_type_id AND ci.coating_id=lpm.coating_id
  WHERE ci.cart_id=p_cart_id
  ORDER BY lpm.id
  FOR SHARE OF lpm;

  FOR v_item IN
    SELECT ci.id AS cart_item_id, ci.product_id, ci.product_color_id, ci.quantity,
           p.name AS product_name, p.type AS product_type, p.price AS product_price,
           b.name AS brand_name, shape.name AS frame_shape, material.name AS frame_material,
           ci.lens_type_id, ci.coating_id,
           lt.name AS lens_name, lc.name AS coating_name, lpm.price AS lens_price
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    LEFT JOIN public.brands b ON b.id = p.brand_id
    LEFT JOIN public.frame_attributes shape ON shape.id=p.frame_shape_id AND shape.attribute_type='shape'
    LEFT JOIN public.frame_attributes material ON material.id=p.frame_material_id AND material.attribute_type='material'
    LEFT JOIN public.lens_types lt ON lt.id=ci.lens_type_id
    LEFT JOIN public.lens_coatings lc ON lc.id=ci.coating_id
    LEFT JOIN public.lens_pricing_matrix lpm
      ON lpm.lens_type_id=ci.lens_type_id AND lpm.coating_id=ci.coating_id
    WHERE ci.cart_id=p_cart_id
    ORDER BY ci.product_id, ci.product_color_id NULLS FIRST, ci.id
    FOR UPDATE OF ci
  LOOP
    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Cart item quantity must be positive';
    END IF;
    v_product_type := v_item.product_type;
    v_product_price := v_item.product_price;
    IF v_product_price IS NULL OR v_product_price < 0 THEN
      RAISE EXCEPTION 'Invalid product price for product %', v_item.product_id;
    END IF;

    SELECT count(*) INTO v_variant_count
    FROM public.product_colors pc WHERE pc.product_id=v_item.product_id;
    IF v_variant_count > 0 THEN
      IF v_item.product_color_id IS NULL THEN
        RAISE EXCEPTION 'A product variant must be selected for product %', v_item.product_id;
      END IF;
      SELECT pc.stock,pc.reserved_stock INTO v_stock,v_reserved
      FROM public.product_colors pc
      WHERE pc.product_id=v_item.product_id AND pc.id=v_item.product_color_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Selected variant does not belong to product %',v_item.product_id; END IF;
      IF v_stock-v_reserved < v_item.quantity THEN RAISE EXCEPTION 'Insufficient stock for selected variant'; END IF;
    ELSE
      IF v_item.product_color_id IS NOT NULL THEN RAISE EXCEPTION 'Selected variant is invalid'; END IF;
      SELECT p.stock,p.reserved_stock INTO v_stock,v_reserved
      FROM public.products p WHERE p.id=v_item.product_id FOR UPDATE;
      IF v_stock-v_reserved < v_item.quantity THEN RAISE EXCEPTION 'Insufficient product stock'; END IF;
    END IF;

    IF v_product_type IN ('frame','eyeglasses') THEN
      IF v_item.lens_type_id IS NULL OR v_item.coating_id IS NULL OR v_item.lens_price IS NULL THEN
        RAISE EXCEPTION 'A valid lens and coating package is required for frames';
      END IF;
      v_lens_price := v_item.lens_price;
    ELSIF v_product_type IN ('accessory','eyedrops') THEN
      IF v_item.lens_type_id IS NOT NULL OR v_item.coating_id IS NOT NULL THEN
        RAISE EXCEPTION 'Non-frame products cannot include lens selections';
      END IF;
      v_lens_price := 0;
    ELSE
      RAISE EXCEPTION 'Unsupported product type for checkout';
    END IF;

    v_unit_price := v_product_price + v_lens_price;
    v_item_subtotal := v_unit_price * v_item.quantity;
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  v_total := v_subtotal + v_shipping_fee;

  INSERT INTO public.orders(
    user_id,customer_name,email,contact_number,fulfillment_method,delivery_address,
    delivery_notes,order_status,subtotal,shipping_fee,total,checkout_idempotency_key
  ) VALUES (
    v_user_id,btrim(p_customer_name),v_email,NULLIF(btrim(p_contact_number),''),
    p_fulfillment_method,NULLIF(btrim(p_delivery_address),''),NULLIF(btrim(p_delivery_notes),''),
    'pending',v_subtotal,v_shipping_fee,v_total,p_checkout_idempotency_key
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.inventory_reservations(order_id,expires_at)
  VALUES(v_order_id,clock_timestamp()+v_ttl)
  RETURNING id INTO v_reservation_id;

  FOR v_item IN
    SELECT ci.id AS cart_item_id, ci.product_id, ci.product_color_id, ci.quantity,
           p.name AS product_name, p.type AS product_type, p.price AS product_price,
           b.name AS brand_name, shape.name AS frame_shape, material.name AS frame_material,
           ci.lens_type_id, ci.coating_id,
           lt.name AS lens_name, lc.name AS coating_name, lpm.price AS lens_price
    FROM public.cart_items ci
    JOIN public.products p ON p.id=ci.product_id
    LEFT JOIN public.brands b ON b.id=p.brand_id
    LEFT JOIN public.frame_attributes shape ON shape.id=p.frame_shape_id AND shape.attribute_type='shape'
    LEFT JOIN public.frame_attributes material ON material.id=p.frame_material_id AND material.attribute_type='material'
    LEFT JOIN public.lens_types lt ON lt.id=ci.lens_type_id
    LEFT JOIN public.lens_coatings lc ON lc.id=ci.coating_id
    LEFT JOIN public.lens_pricing_matrix lpm ON lpm.lens_type_id=ci.lens_type_id AND lpm.coating_id=ci.coating_id
    WHERE ci.cart_id=p_cart_id
    ORDER BY ci.product_id,ci.product_color_id NULLS FIRST,ci.id
  LOOP
    v_lens_price := CASE WHEN v_item.product_type IN ('frame','eyeglasses') THEN v_item.lens_price ELSE 0 END;
    v_unit_price := v_item.product_price + v_lens_price;
    INSERT INTO public.order_items(
      order_id,product_id,product_name,brand_name,frame_shape,frame_material,
      quantity,unit_price,subtotal,lens_type_id,coating_id,lens_package_name,product_color_id
    ) VALUES (
      v_order_id,v_item.product_id,v_item.product_name,v_item.brand_name,v_item.frame_shape,v_item.frame_material,
      v_item.quantity,v_unit_price,v_unit_price*v_item.quantity,
      v_item.lens_type_id,v_item.coating_id,
      CASE WHEN v_item.lens_name IS NOT NULL THEN v_item.lens_name || ' + ' || v_item.coating_name ELSE NULL END,
      v_item.product_color_id
    ) RETURNING id INTO v_order_item_id;

    IF v_item.product_color_id IS NOT NULL THEN
      UPDATE public.product_colors pc SET reserved_stock=pc.reserved_stock+v_item.quantity
      WHERE pc.id=v_item.product_color_id AND pc.product_id=v_item.product_id
        AND pc.stock-pc.reserved_stock>=v_item.quantity;
    ELSE
      UPDATE public.products p SET reserved_stock=p.reserved_stock+v_item.quantity
      WHERE p.id=v_item.product_id AND p.stock-p.reserved_stock>=v_item.quantity;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock changed during checkout'; END IF;

    INSERT INTO public.inventory_reservation_items(
      reservation_id,order_item_id,product_id,product_color_id,quantity
    ) VALUES(v_reservation_id,v_order_item_id,v_item.product_id,v_item.product_color_id,v_item.quantity);
  END LOOP;

  UPDATE public.carts SET status='converted',updated_at=now() WHERE id=p_cart_id;
  RETURN jsonb_build_object('order_id',v_order_id,'reservation_id',v_reservation_id,'idempotent_replay',false);
END;
$function$
;
COMMIT;

