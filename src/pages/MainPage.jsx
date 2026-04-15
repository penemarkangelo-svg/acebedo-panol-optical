
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function MainPage() {
  // const { user } = useAuth(); // after AuthContext is set up
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center px-6">
        <h1 className="text-3xl font-bold text-[#212529] mb-4">
          Welcome!
        </h1>
        <p className="text-gray-600">
          Start your vision test or browse frames.
        </p>
        {/* Add links to vision test and shop */}
      </main>
      <Footer />
    </>
  );
}
