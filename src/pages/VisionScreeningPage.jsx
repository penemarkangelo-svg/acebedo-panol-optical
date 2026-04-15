import { useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Step1_PreScreening from "../components/VisionScreening/Step1_PreScreening";
// Import other steps later

export default function VisionScreeningPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [testData, setTestData] = useState({});

  const updateTestData = (newData) => {
    setTestData((prev) => ({ ...prev, ...newData }));
  };

  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  // For now, only step 0 exists
  const steps = [Step1_PreScreening];

  const CurrentStep = steps[currentStep];

  return (
    <>
      <Header />
      <main className="bg-white min-h-[calc(100vh-200px)] py-12 px-6 md:px-12 lg:px-20">
        <div className="max-w-4xl mx-auto">
          <CurrentStep
            data={testData}
            updateData={updateTestData}
            onNext={nextStep}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
