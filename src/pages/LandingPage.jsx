import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Hero from "../components/Hero";
import Footer from "../components/Footer";
import TryOnModal from "../components/TryOnModal";
import { supabase } from "../lib/supabaseClient";
import { getProductCategory, usesVariantStock } from "../utils/productTypes";
import "../styles/LandingPage.css";

function getPrimaryImage(product) {
  const images = [...(product.product_images || [])].sort(
    (first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0)
  );
  return images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || "";
}

function frameIsAvailable(product) {
  if (usesVariantStock(product.type)) {
    return (product.product_colors || []).some((color) => Number(color.stock || 0) > 0);
  }
  return Number(product.stock || 0) > 0;
}

function formatPrice(price) {
  return `₱${Number(price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default function LandingPage() {
  const [frames, setFrames] = useState([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [selectedFrameId, setSelectedFrameId] = useState(null);
  const [tryOnProduct, setTryOnProduct] = useState(null);
  const carouselRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadFrames() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            *,
            brands (id, name),
            frame_shape:frame_attributes!products_frame_shape_id_fkey (id, name),
            frame_material:frame_attributes!products_frame_material_id_fkey (id, name),
            product_images (id, image_url, is_primary, sort_order),
            product_colors (id, color_name, color_code, image_id, stock)
          `)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (error) {
          setCatalogState("error");
          return;
        }

        const availableFrames = (data || []).filter(
          (product) => getProductCategory(product) === "eyeglasses" && frameIsAvailable(product)
        );
        setFrames(availableFrames);
        setSelectedFrameId(availableFrames[0]?.id ?? null);
        setCatalogState("ready");
      } catch {
        if (active) setCatalogState("error");
      }
    }

    loadFrames();
    return () => { active = false; };
  }, []);

  const featuredFrame = useMemo(
    () => frames.find((frame) => String(frame.id) === String(selectedFrameId)) || frames[0] || null,
    [frames, selectedFrameId]
  );

  const openTryOn = (product) => {
    if (product) setTryOnProduct(product);
  };

  const scrollFrames = (direction) => {
    carouselRef.current?.scrollBy({ left: direction * 380, behavior: "smooth" });
  };

  return (
    <div className="landing-page">
      <Header />
      <main>
        <Hero featuredFrame={featuredFrame} onTryOn={openTryOn} />

        <section className="landing-frame-edit" id="frame-edit" aria-labelledby="landing-frame-title">
          <div className="landing-section-shell">
            <div className="landing-section-heading">
              <h2 id="landing-frame-title">Everyday icons.</h2>
              <div className="landing-carousel-controls" aria-label="Frame carousel controls">
                <button type="button" onClick={() => scrollFrames(-1)} aria-label="Previous frames">←</button>
                <button type="button" onClick={() => scrollFrames(1)} aria-label="Next frames">→</button>
              </div>
            </div>

            {catalogState === "loading" && <p className="landing-catalog-message">Finding frames for you…</p>}
            {catalogState === "error" && (
              <p className="landing-catalog-message">Frames are unavailable right now. <Link to="/shop">Browse the collection</Link>.</p>
            )}
            {catalogState === "ready" && frames.length === 0 && (
              <p className="landing-catalog-message">No in-stock frames are ready to feature. <Link to="/shop">Browse the collection</Link>.</p>
            )}
            {frames.length > 0 && (
              <div className="landing-frame-track" ref={carouselRef} role="region" aria-label="Featured eyeglasses">
                {frames.map((frame, index) => {
                  const image = getPrimaryImage(frame);
                  const brand = frame.brands?.name || "Acebedo Panol Optical";

                  return (
                    <article className="landing-frame" key={frame.id}>
                      <Link
                        className="landing-frame__image-link"
                        to={`/product/${frame.id}`}
                        onClick={() => setSelectedFrameId(frame.id)}
                        aria-label={`View ${frame.name}`}
                      >
                        {image ? <img src={image} alt={`${frame.name} eyeglasses`} loading={index < 3 ? "eager" : "lazy"} /> : <span className="landing-frame__image-fallback">ACEBEDO</span>}
                      </Link>
                      <div className="landing-frame__details">
                        <span className="landing-frame__brand">{brand}</span>
                        <div className="landing-frame__product-row">
                          <div>
                            <Link to={`/product/${frame.id}`} onFocus={() => setSelectedFrameId(frame.id)} onMouseEnter={() => setSelectedFrameId(frame.id)}>{frame.name}</Link>
                            <span className="landing-frame__price">{formatPrice(frame.price)}</span>
                          </div>
                          <button className="landing-frame__try-action" type="button" onClick={() => { setSelectedFrameId(frame.id); openTryOn(frame); }}>Try on <span aria-hidden="true">→</span></button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <Link className="landing-section-link" to="/shop">View all frames <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="landing-care" aria-labelledby="landing-care-title">
          <div className="landing-section-shell landing-care__layout">
            <div className="landing-care__intro">
              <h2 id="landing-care-title">Care, with a human touch.</h2>
              <Link className="landing-text-link" to="/appointments/book">Get to know our approach <span aria-hidden="true">→</span></Link>
            </div>
            <div className="landing-care__list">
              <Link to="/appointments/book"><span>01</span><div><strong>A thoughtful eye exam</strong><small>Personal attention for your vision and your needs.</small></div><b aria-hidden="true">↗</b></Link>
              <Link to="/shop"><span>02</span><div><strong>The right frame, just for you</strong><small>Explore considered shapes, materials, and details.</small></div><b aria-hidden="true">↗</b></Link>
              <Link to="/vision-screening"><span>03</span><div><strong>A first look at your vision</strong><small>Try a preliminary screening from home. It is not a diagnosis.</small></div><b aria-hidden="true">↗</b></Link>
            </div>
          </div>
        </section>

        <section className="landing-appointment" aria-labelledby="landing-appointment-title">
          <div className="landing-section-shell landing-appointment__inner">
            <div>
              <h2 id="landing-appointment-title">See well. Feel yourself.</h2>
              <p>A little time for your eyes, with care tailored to you.</p>
            </div>
            <Link className="landing-button landing-button--primary" to="/appointments/book">Book an eye exam <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>
      <Footer />
      {tryOnProduct && <TryOnModal product={tryOnProduct} onClose={() => setTryOnProduct(null)} />}
    </div>
  );
}
