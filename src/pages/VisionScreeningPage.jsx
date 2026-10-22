import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";

import VisionProgress from "../vision-screening/components/VisionProgress";
import ScreeningIntro from "../vision-screening/components/ScreeningIntro";
import Questionnaire from "../vision-screening/components/Questionnaire";
import EnvironmentSetup from "../vision-screening/components/EnvironmentSetup";
import VisualAcuity from "../vision-screening/components/VisualAcuity";
import Duochrome from "../vision-screening/components/Duochrome";
import ClockDial from "../vision-screening/components/ClockDial";
import ScreeningResults from "../vision-screening/components/ScreeningResults";

export default function VisionScreeningPage() {
  const navigate = useNavigate();

  /*
   * ------------------------------------------------------------
   * SCREENING STATE
   * ------------------------------------------------------------
   *
   * 0 = Questionnaire
   * 1 = Setup
   * 2 = Visual Acuity
   * 3 = Duochrome
   * 4 = Clock Dial
   * 5 = Results
   *
   * Questionnaire is temporarily skipped while we work on
   * the Environment Setup UI.
   */

  const [showIntro, setShowIntro] = useState(true);

  /*
   * Start directly at Setup for now.
   */
  const [currentStage, setCurrentStage] = useState(1);

  const [testData, setTestData] = useState({});

  /*
   * ------------------------------------------------------------
   * SHARED TEST DATA
   * ------------------------------------------------------------
   */

  const updateTestData = (newData) => {
    setTestData((previous) => ({
      ...previous,
      ...newData,
    }));
  };

  /*
   * ------------------------------------------------------------
   * INTRO
   * ------------------------------------------------------------
   */

  const handleStart = () => {
    setShowIntro(false);

    /*
     * Temporarily skip Questionnaire.
     *
     * Begin directly with Environment Setup.
     */
    setCurrentStage(1);
  };

  const handleCancelScreening = () => {
    navigate(-1);
  };

  /*
   * ------------------------------------------------------------
   * QUESTIONNAIRE
   * ------------------------------------------------------------
   *
   * Kept here for later.
   * It is not currently rendered because Setup is the
   * temporary starting point.
   */

  const handleQuestionnaireComplete = () => {
    setCurrentStage(1);
  };

  /*
   * ------------------------------------------------------------
   * SETUP
   * ------------------------------------------------------------
   */

  const handleSetupComplete = (calibrationResult) => {
    updateTestData({
      calibration: calibrationResult || null,
    });

    /*
     * Move to Visual Acuity.
     */
    setCurrentStage(2);
  };

  /*
   * ------------------------------------------------------------
   * VISUAL ACUITY
   * ------------------------------------------------------------
   */

  const handleVisualAcuityComplete = (acuityResult) => {
    /*
     * VisualAcuity finishes its trials here.
     *
     * Save the result, but do not advance yet because
     * VisualAcuity has its own result/continue step.
     */
    updateTestData({
      visualAcuity: acuityResult || null,
    });
  };

  const handleVisualAcuityContinue = (acuityResult) => {
    /*
     * Save the result if one was supplied.
     */
    if (acuityResult) {
      updateTestData({
        visualAcuity: acuityResult,
      });
    }

    /*
     * Move to Duochrome.
     */
    setCurrentStage(3);
  };

  /*
   * ------------------------------------------------------------
   * DUOCHROME
   * ------------------------------------------------------------
   */

  const handleDuochromeComplete = (duochromeResult) => {
    updateTestData({
      duochrome: duochromeResult || null,
    });

    /*
     * Move to Clock Dial.
     */
    setCurrentStage(4);
  };

  /*
   * ------------------------------------------------------------
   * CLOCK DIAL
   * ------------------------------------------------------------
   */

  const handleClockDialComplete = (clockDialResult) => {
    updateTestData({
      clockDial: clockDialResult || null,
    });

    /*
     * Move to Results.
     */
    setCurrentStage(5);
  };

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <>
      <Header />

      <main className="acebedo-page">
        <div className="acebedo-container py-8 md:py-12">
          {!showIntro && (
            <>
              {/* ==================================================
                  VISION SCREENING PROGRESS
                  ================================================== */}

              <div className="mb-10">
                <VisionProgress
                  currentStage={currentStage}
                />
              </div>

              {/* ==================================================
                  STAGE 0 — QUESTIONNAIRE
                  ==================================================
                  
                  Temporarily not rendered.
                  Questionnaire remains in the project and can be
                  restored later.
              */}

              {/*
              {currentStage === 0 && (
                <Questionnaire
                  data={testData}
                  updateData={updateTestData}
                  onComplete={handleQuestionnaireComplete}
                />
              )}
              */}

              {/* ==================================================
                  STAGE 1 — SETUP
                  ================================================== */}

              {currentStage === 1 && (
                <EnvironmentSetup
                  onComplete={handleSetupComplete}
                />
              )}

              {/* ==================================================
                  STAGE 2 — VISUAL ACUITY
                  ================================================== */}

              {currentStage === 2 && (
                <VisualAcuity
                  onComplete={handleVisualAcuityComplete}
                  onContinue={handleVisualAcuityContinue}
                />
              )}

              {/* ==================================================
                  STAGE 3 — DUOCHROME
                  ================================================== */}

              {currentStage === 3 && (
                <Duochrome
                  onComplete={handleDuochromeComplete}
                />
              )}

              {/* ==================================================
                  STAGE 4 — CLOCK DIAL
                  ================================================== */}

              {currentStage === 4 && (
                <ClockDial
                  onComplete={handleClockDialComplete}
                />
              )}

              {/* ==================================================
                  STAGE 5 — RESULTS
                  ================================================== */}

              {currentStage === 5 && (
                <ScreeningResults
                  testData={testData}
                />
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* ========================================================
          INTRODUCTION
          ======================================================== */}

      {showIntro && (
        <ScreeningIntro
          onStart={handleStart}
          onClose={handleCancelScreening}
        />
      )}
    </>
  );
}