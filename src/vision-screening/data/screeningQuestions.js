const screeningQuestions = [
  {
    id: "age",
    section: "Basic Information",
    question: "What is your age?",
    type: "number",
    required: true,
    min: 5,
    max: 100,
    placeholder: "Enter your age",
  },

  {
    id: "visionConcern",
    section: "Current Vision Concerns",
    question: "What is your main reason for taking this vision screening?",
    type: "radio",
    required: true,
    options: [
      "Routine vision check",
      "I have noticed changes in my vision",
      "I am having difficulty seeing clearly",
      "I am considering new eyeglasses",
      "Other",
    ],
  },

  {
    id: "distanceVision",
    section: "Current Vision Concerns",
    question: "How would you describe your distance vision?",
    type: "radio",
    required: true,
    options: [
      "Clear",
      "Sometimes blurry",
      "Often blurry",
      "Very blurry",
      "Not sure",
    ],
  },

  {
    id: "nearVision",
    section: "Current Vision Concerns",
    question: "How would you describe your near vision?",
    type: "radio",
    required: true,
    options: [
      "Clear",
      "Sometimes blurry",
      "Often blurry",
      "Very blurry",
      "Not sure",
    ],
  },

  {
    id: "eyeSymptoms",
    section: "Current Vision Concerns",
    question: "Have you recently experienced any of the following?",
    type: "checkbox",
    required: true,
    options: [
      "Eye strain or tired eyes",
      "Headaches while reading or using screens",
      "Difficulty focusing",
      "Double vision",
      "Sensitivity to light",
      "None of these",
    ],
  },

  {
    id: "currentGlasses",
    section: "Eye and Eyewear History",
    question: "Do you currently wear corrective eyewear?",
    type: "radio",
    required: true,
    options: [
      "Glasses",
      "Contact lenses",
      "Both glasses and contact lenses",
      "No corrective eyewear",
    ],
  },

  {
    id: "lastEyeExam",
    section: "Eye and Eyewear History",
    question: "When was your last eye examination?",
    type: "radio",
    required: true,
    options: [
      "Within the last 6 months",
      "6–12 months ago",
      "1–2 years ago",
      "More than 2 years ago",
      "I have never had an eye examination",
      "I don't remember",
    ],
  },

  {
    id: "eyeCondition",
    section: "Eye and Eyewear History",
    question: "Have you ever been diagnosed with an eye condition?",
    type: "radio",
    required: true,
    options: [
      "Yes",
      "No",
      "I'm not sure",
    ],
  },

  {
    id: "eyeConditionDetails",
    section: "Eye and Eyewear History",
    question: "If yes, please describe the eye condition.",
    type: "textarea",
    required: false,
    placeholder: "Optional",
  },

  {
    id: "eyeSurgery",
    section: "Eye and Eyewear History",
    question: "Have you ever had eye surgery or an eye procedure?",
    type: "radio",
    required: true,
    options: [
      "Yes",
      "No",
      "I'm not sure",
    ],
  },

  {
    id: "healthConditions",
    section: "Relevant Health History",
    question: "Do you have any health conditions that may affect your vision?",
    type: "radio",
    required: true,
    options: [
      "Yes",
      "No",
      "I'm not sure",
    ],
  },

  {
    id: "medications",
    section: "Relevant Health History",
    question: "Are you currently taking medication that may affect your vision?",
    type: "radio",
    required: true,
    options: [
      "Yes",
      "No",
      "I'm not sure",
    ],
  },

  {
    id: "screenTime",
    section: "Work and Digital Habits",
    question: "How many hours per day do you typically spend using digital screens?",
    type: "radio",
    required: true,
    options: [
      "Less than 2 hours",
      "2–4 hours",
      "4–6 hours",
      "6–8 hours",
      "More than 8 hours",
    ],
  },

  {
    id: "workEnvironment",
    section: "Work and Digital Habits",
    question: "What best describes your typical work or study environment?",
    type: "radio",
    required: true,
    options: [
      "Mostly indoors",
      "Mostly outdoors",
      "Mostly computer-based",
      "A combination of indoor and outdoor work",
      "Other",
    ],
  },

  {
    id: "screeningAcknowledgment",
    section: "Screening Acknowledgment",
    question:
      "Do you understand that this is a preliminary vision screening and does not replace a comprehensive eye examination?",
    type: "radio",
    required: true,
    options: [
      "Yes, I understand",
      "No",
    ],
  },
];

export default screeningQuestions;