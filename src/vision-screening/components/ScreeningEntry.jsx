import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ScreeningIntro from "./ScreeningIntro";

export function ScreeningLink({ children, className }) {
  const { pathname, search, hash, state } = useLocation();

  return (
    <Link
      to={{ pathname, search, hash }}
      replace={false}
      state={{ ...state, screeningIntro: "storefront" }}
      className={className}
      aria-haspopup="dialog"
    >
      {children}
    </Link>
  );
}

export default function ScreeningEntry() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (!state?.screeningIntro) return null;

  const closeIntro = () => {
    if (state.screeningIntro === "storefront") {
      navigate(-1);
    } else {
      navigate("/shop", { replace: true });
    }
  };

  const startScreening = () => {
    navigate(user ? "/vision-screening" : "/login", {
      replace: true,
      state: { screeningStarted: true },
    });
  };

  return <ScreeningIntro onStart={startScreening} onClose={closeIntro} startDisabled={loading} />;
}
