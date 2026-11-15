import { Link } from "react-router-dom";
import "../styles/Footer.css";

export default function Footer() {
  return (
    <footer className="acebedo-footer">
      <div className="acebedo-footer__inner">
        <div className="acebedo-footer__main">
          <div className="acebedo-footer__brand">
            <Link className="acebedo-footer__wordmark" to="/">
              ACEBEDO
              <span>PANOL OPTICAL</span>
            </Link>
            <p>Professional eyeglass care and digital vision screening, for your sight and your style.</p>
          </div>

          <nav className="acebedo-footer__links" aria-label="Footer links">
            <div className="acebedo-footer__group">
              <h2>Navigation</h2>
              <Link to="/">Home</Link>
              <Link to="/shop">Shop frames</Link>
              <Link to="/vision-screening">Vision test</Link>
            </div>
            <div className="acebedo-footer__group">
              <h2>Support</h2>
              <a href="#store-location">Contact us</a>
              <Link to="/orders">Orders</Link>
              <Link to="/cart">Shopping bag</Link>
            </div>
            <div className="acebedo-footer__group acebedo-footer__group--legal">
              <h2>Legal</h2>
              <span>Privacy policy</span>
              <span>Terms of service</span>
            </div>
            <div className="acebedo-footer__group">
              <h2>Connect</h2>
              <span>Rosario, Cavite</span>
              <a href="#store-location">Store location</a>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Acebedo+Panol+Optical%2C+CV36%2BC68%2C+General+Trias+Drive%2C+Rosario%2C+Cavite"
                target="_blank"
                rel="noreferrer"
              >
                Get directions ↗
              </a>
            </div>
          </nav>
        </div>

        <section className="acebedo-footer__location" id="store-location" aria-labelledby="acebedo-footer-location-title">
          <div className="acebedo-footer__location-copy">
            <p className="acebedo-footer__eyebrow">VISIT ACEBEDO</p>
            <h2 id="acebedo-footer-location-title">Find us in Rosario.</h2>
            <p>CV36+C68, General Trias Drive<br />Rosario, Cavite 4106</p>
            <a
              className="acebedo-footer__directions"
              href="https://www.google.com/maps/search/?api=1&query=Acebedo+Panol+Optical%2C+CV36%2BC68%2C+General+Trias+Drive%2C+Rosario%2C+Cavite"
              target="_blank"
              rel="noreferrer"
            >
              Get directions <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="acebedo-footer__map">
            <iframe
              title="Map showing Acebedo Panol Optical in Rosario, Cavite"
              src="https://www.google.com/maps?q=Acebedo+Panol+Optical%2C+CV36%2BC68%2C+General+Trias+Drive%2C+Rosario%2C+Cavite&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>

        <div className="acebedo-footer__bottom">
          <span>© 2026 Acebedo Panol Optical</span>
          <span>Rosario, Cavite · Philippines</span>
        </div>
      </div>
    </footer>
  );
}
