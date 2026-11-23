import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiChevronDown, FiChevronUp, FiLogOut } from "react-icons/fi";

import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

import VisionProgress, { screeningStages } from "../vision-screening/components/VisionProgress";
import Questionnaire from "../vision-screening/components/Questionnaire";
import EnvironmentSetup from "../vision-screening/components/EnvironmentSetup";
import VisualAcuity from "../vision-screening/components/VisualAcuity";
import Duochrome from "../vision-screening/components/Duochrome";
import ClockDial from "../vision-screening/components/ClockDial";
import ScreeningResults from "../vision-screening/components/ScreeningResults";
import {
  buildScreeningData,
  createSubmissionId,
  getScreeningCompletionIssues,
  persistCompletedScreening,
} from "../vision-screening/utils/screeningPersistence";

// Keep false for the normal screening flow; enable only during local camera tests.
const SKIP_QUESTIONNAIRE_FOR_TESTING = false;

export default function VisionScreeningPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
   * During camera testing the temporary flag below starts at Setup.
   */

  /*
   * Start at Setup while the temporary camera-test flag is enabled.
   */
  const [currentStage, setCurrentStage] = useState(SKIP_QUESTIONNAIRE_FOR_TESTING ? 1 : 0);
  const [progressVisibility, setProgressVisibility] = useState({});

  const [testData, setTestData] = useState({});
  const [startedAt] = useState(() => new Date().toISOString());
  const [submissionId] = useState(createSubmissionId);
  const saveStateRef = useRef({ inFlight: false, savedId: null });
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentStage]);

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
   * EXIT
   * ------------------------------------------------------------
   */

  const exitScreening = () => {
    if (currentStage < 5 && !window.confirm("Exit screening? Your progress in this session will be lost.")) {
      return;
    }
    navigate("/shop", { replace: true });
  };

  /*
   * ------------------------------------------------------------
   * QUESTIONNAIRE
   * ------------------------------------------------------------
   *
   * The questionnaire remains the normal stage when the temporary
   * camera-test flag is disabled.
   */

  const handleQuestionnaireComplete = (answers) => {
    setTestData((previous) => ({
      ...previous,
      questionnaireAnswers: answers,
      questionnaireCompletedAt: new Date().toISOString(),
    }));
    setCurrentStage(1);
  };

  const updateQuestionnaireAnswers = (answers) => {
    setTestData((previous) => ({
      ...previous,
      questionnaireAnswers: answers,
    }));
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

  const saveCompletedScreening = async (completedData) => {
    if (SKIP_QUESTIONNAIRE_FOR_TESTING) return;
    if (saveStateRef.current.inFlight || saveStateRef.current.savedId) return;

    const completionIssues = getScreeningCompletionIssues({
      questionnaireAnswers: completedData.questionnaireAnswers,
      visualAcuity: completedData.visualAcuity,
      duochrome: completedData.duochrome,
      clockDial: completedData.clockDial,
    });

    if (completionIssues.length > 0) {
      const message = "Your screening is incomplete, so no results were saved. Please restart the screening.";
      setSaveError(message);
      setSaveStatus("error");
      toast.error(message);
      return;
    }

    if (!user?.id) {
      const message = "You need to be signed in to save your screening results. Please sign in and try again.";
      setSaveError(message);
      setSaveStatus("error");
      toast.error(message);
      return;
    }

    saveStateRef.current.inFlight = true;
    setSaveError("");
    setSaveStatus("saving");

    try {
      const screeningData = buildScreeningData({
        ...completedData,
        startedAt,
        completedAt: new Date().toISOString(),
        submissionId,
      });
      const savedRecord = await persistCompletedScreening({
        client: supabase,
        userId: user.id,
        screeningData,
      });

      saveStateRef.current.savedId = savedRecord.id;
      setSaveStatus("saved");
      toast.success("Your screening results were saved.");
    } catch (error) {
      console.error("Unable to save vision screening results:", error);
      const message = "We couldn't save your screening results. Check your connection and try again.";
      setSaveError(message);
      setSaveStatus("error");
      toast.error(message);
    } finally {
      saveStateRef.current.inFlight = false;
    }
  };

  const handleClockDialComplete = (clockDialResult) => {
    const completedData = {
      ...testData,
      clockDial: clockDialResult || null,
    };
    setTestData(completedData);
    setCurrentStage(5);
    if (SKIP_QUESTIONNAIRE_FOR_TESTING) {
      setSaveStatus("test-only");
    } else {
      saveCompletedScreening(completedData);
    }
  };

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  const wideLayoutClassName = [0, 1, 5].includes(currentStage) ? " acebedo-screening-wide" : "";
  const isFocusedStage = currentStage > 0 && currentStage < 5;
  const layoutClassName = isFocusedStage ? " vision-screening-focused" : " pb-8 pt-3 md:pb-12 md:pt-4";
  const showProgress = progressVisibility[currentStage] ?? !isFocusedStage;
  const progressLabel = showProgress ? "Hide progress" : "Show progress";
  const exitLabel = currentStage === 5 ? "Back to Shop Frames" : "Exit screening";
  const skippedStages = SKIP_QUESTIONNAIRE_FOR_TESTING ? 1 : 0;
  const step = currentStage + 1 - skippedStages;
  const stepCount = screeningStages.length - skippedStages;
  const ProgressChevron = showProgress ? FiChevronUp : FiChevronDown;

  return (
    <main className="acebedo-page vision-screening-page">
      <div className={`acebedo-container${layoutClassName}${wideLayoutClassName}`}>
        <div className="vision-screening-navigation">
          <header className="vision-screening-session">
            <button
              type="button"
              className="vision-screening-session__exit"
              aria-label={exitLabel}
              title={exitLabel}
              onClick={exitScreening}
              disabled={saveStatus === "saving"}
            >
              <FiLogOut size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="vision-screening-session__progress"
              aria-label={`${progressLabel}. Step ${step} of ${stepCount}.`}
              title={progressLabel}
              aria-expanded={showProgress}
              aria-controls="vision-screening-progress"
              onClick={() => setProgressVisibility((previous) => ({ ...previous, [currentStage]: !showProgress }))}
            >
              <span className="vision-screening-session__track" aria-hidden="true">
                <span style={{ width: `${(step / stepCount) * 100}%` }} />
              </span>
              <span aria-hidden="true">{step} / {stepCount}</span>
              <ProgressChevron size={16} aria-hidden="true" />
            </button>
          </header>
          <div id="vision-screening-progress" className="acebedo-screening-progress-wrap" hidden={!showProgress}>
            <VisionProgress
              currentStage={currentStage}
              skipQuestionnaire={SKIP_QUESTIONNAIRE_FOR_TESTING}
            />
          </div>
        </div>

        {/* ==================================================
            STAGE 0 — QUESTIONNAIRE
            ==================================================

            Normal intake stage when not in temporary camera-test mode.
        */}
        {currentStage === 0 && (
          <Questionnaire
            data={testData.questionnaireAnswers || {}}
            updateData={updateQuestionnaireAnswers}
            onComplete={handleQuestionnaireComplete}
          />
        )}

        {isFocusedStage && (
          <div className="vision-screening-stage">
            {currentStage === 1 && <EnvironmentSetup onComplete={handleSetupComplete} />}
            {currentStage === 2 && (
              <VisualAcuity
                onComplete={handleVisualAcuityComplete}
                onContinue={handleVisualAcuityContinue}
              />
            )}
            {currentStage === 3 && <Duochrome onComplete={handleDuochromeComplete} />}
            {currentStage === 4 && <ClockDial onComplete={handleClockDialComplete} />}
          </div>
        )}

        {/* ==================================================
            STAGE 5 — RESULTS
            ================================================== */}

        {currentStage === 5 && (
          <>
            {saveStatus === "test-only" && (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                Test run: the questionnaire was skipped, so these results were not saved.
              </p>
            )}
            {saveStatus === "saving" && (
              <p className="mb-4 text-sm text-gray-600" role="status">
                Saving your screening results…
              </p>
            )}
            {saveStatus === "error" && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                <p>{saveError}</p>
                <button
                  type="button"
                  onClick={() => saveCompletedScreening(testData)}
                  className="mt-2 font-semibold underline"
                >
                  Retry saving
                </button>
              </div>
            )}
            <ScreeningResults
              acuity={testData.visualAcuity}
              duochrome={testData.duochrome}
              clockDial={testData.clockDial}
            />
          </>
        )}
      </div>
    </main>
  );
}
