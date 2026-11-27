import heroImage from "../assets/acebedo-hero-frames-warm.png";
import { Link } from "react-router-dom";

export default function Hero({ featuredFrame, onTryOn }) {
  const tryOnFeaturedFrame = () => {
    if (featuredFrame) onTryOn(featuredFrame);
  };

  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="landing-hero__visual">
        <img
          className="landing-hero__image"
          src={heroImage}
          alt="A selection of eyeglass frames arranged against a neutral background"
          fetchPriority="high"
        />
      </div>

      <div className="landing-hero__copy">
        <h1 id="landing-hero-title">Frames that feel like <em>you.</em></h1>
        <p className="landing-hero__description">
          Explore a thoughtful selection of frames for every day.
        </p>
        <div className="landing-hero__actions">
          {featuredFrame ? (
            <button className="landing-button landing-button--primary" type="button" onClick={tryOnFeaturedFrame}>
              Try on a featured frame<span aria-hidden="true"></span>
            </button>
          ) : (
            <Link className="landing-button landing-button--primary" to="/shop">
              Browse frames <span aria-hidden="true">→</span>
            </Link>
          )}
          <Link className="landing-text-link" to="/shop">Explore frames</Link>
        </div>
      </div>
    </section>
  );
}
