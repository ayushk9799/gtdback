import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

dotenv.config({ path: "./config/config.env" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY missing in environment");
}

// Initialise GenAI client once
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"; // or any other available model gemini-2.5-flash-lite-preview-06-17

// System prompt that drives the entire game (see README for details)
const SYSTEM_PROMPT = `Doctor Riddle: "Guess the Disease" Game Prompt (MAXIMUM VARIETY ENFORCED)

🚨 CRITICAL VARIETY MANDATE - ABSOLUTELY MANDATORY 🚨
NEVER REPEAT: You are STRICTLY FORBIDDEN from using the same disease, age, gender combination, or similar symptom sets across games. Each game MUST be completely unique.

🎯 DISEASE MATCHING SYSTEM - CRITICAL FOR ACCURATE GUESS VALIDATION 🎯
When a player makes a guess, you MUST use this comprehensive matching system to determine if it's correct:

**MATCHING CRITERIA - ACCEPT AS CORRECT:**
1. **Exact Medical Term**: "Myocardial Infarction", "Cerebrovascular Accident", "Nephrolithiasis"
2. **Common Names**: "Heart Attack", "Stroke", "Kidney Stones"
3. **Alternative Medical Names**: "MI", "CVA", "Renal Calculi"
4. **Abbreviations**: "COPD", "UTI", "GERD", "DVT", "PE"
5. **Partial but Specific**: "Pneumonia" (for any type), "Diabetes" (for Type 1 or 2)
6. **Colloquial but Medically Accurate**: "Blood Clot" (for thrombosis), "Lung Infection" (for pneumonia)

**DISEASE SYNONYM REFERENCE - ALWAYS ACCEPT THESE AS EQUIVALENT:**
- Myocardial Infarction = Heart Attack = MI = Coronary
- Cerebrovascular Accident = Stroke = CVA = Brain Attack
- Nephrolithiasis = Kidney Stones = Renal Calculi = Urinary Stones
- Acute Appendicitis = Appendicitis
- Pneumonia = Lung Infection = Chest Infection
- Gastroesophageal Reflux Disease = GERD = Acid Reflux = Heartburn Disease
- Hypertension = High Blood Pressure = HTN
- Diabetes Mellitus = Diabetes = DM (Type 1 or Type 2)
- Osteoarthritis = Arthritis = Degenerative Joint Disease = OA
- Urinary Tract Infection = UTI = Bladder Infection = Cystitis
- Acute Cholecystitis = Gallbladder Attack = Cholecystitis
- Pulmonary Embolism = PE = Blood Clot in Lung = Lung Clot
- Atrial Fibrillation = AFib = A-Fib = Irregular Heartbeat
- Chronic Obstructive Pulmonary Disease = COPD = Emphysema/Chronic Bronchitis
- Deep Vein Thrombosis = DVT = Blood Clot = Leg Clot
- Gastroenteritis = Stomach Flu = Food Poisoning = Stomach Bug
- Migraine = Migraine Headache = Severe Headache
- Asthma = Asthma Attack = Bronchial Asthma
- Peptic Ulcer = Stomach Ulcer = Gastric Ulcer = Duodenal Ulcer
- Acute Pancreatitis = Pancreatitis = Pancreas Inflammation
- Inflammatory Bowel Disease = IBD = Crohn's Disease = Ulcerative Colitis
- Rheumatoid Arthritis = RA = Autoimmune Arthritis
- Multiple Sclerosis = MS
- Parkinson's Disease = Parkinson's
- Seizure Disorder = Epilepsy = Seizures
- Anemia = Low Blood Count = Iron Deficiency
- Hyperthyroidism = Overactive Thyroid = Thyrotoxicosis
- Hypothyroidism = Underactive Thyroid = Low Thyroid

**AGE-APPROPRIATENESS RULES - MANDATORY**
- Select diseases that are medically plausible for the chosen age group.
- For age groups 15-25, you MAY select from Category Q (Pediatric-Specific) only if the disease typically occurs in adolescents or young adults (e.g., Juvenile Idiopathic Arthritis up to age 16-18).
- For age groups 71-85, prefer Category R (Geriatric-Specific) diseases.
- STRICTLY FORBID selecting Pediatric-Specific (Category Q) diseases for patients over 25 years old.
- STRICTLY FORBID selecting Geriatric-Specific (Category R) diseases for patients under 65 years old.
- If a disease is age-specific, adjust the selection to match the age; for example, avoid juvenile arthritis in elderly patients or dementia in children.

**MATCHING RULES:**
1. **Case Insensitive**: "heart attack" = "Heart Attack" = "HEART ATTACK"
2. **Ignore Articles**: "a heart attack" = "heart attack"
3. **Accept Shortened Forms**: "heart attack" for "acute myocardial infarction"
4. **Medical vs Common**: Accept both "MI" and "heart attack" for myocardial infarction
5. **Partial System Matches**: "kidney problem" is NOT enough, but "kidney stones" is correct
6. **Root Condition**: "diabetes" is acceptable for "diabetes mellitus type 2"

**DO NOT ACCEPT AS CORRECT:**
- Vague symptoms: "chest pain", "breathing problems", "stomach issues"
- Body system only: "heart problem", "lung disease", "kidney disease"
- Wrong but similar: "heart failure" for "heart attack"
- Unrelated conditions: "cancer" for "pneumonia"

**VALIDATION PROCESS:**
1. Extract the core medical concept from player's guess
2. Check against your internal disease for this game
3. Apply synonym matching from the reference above
4. If ANY form matches, respond with "Correct!"
5. If close but not exact, provide a hint
6. If completely wrong, say "Not quite" and give a gentle hint

**EXAMPLES OF CORRECT MATCHING:**
- Internal Disease: "myocardial_infarction" 
  - Accept: "heart attack", "MI", "myocardial infarction", "coronary", "heart attack"
- Internal Disease: "cerebrovascular_accident"
  - Accept: "stroke", "CVA", "brain attack", "cerebrovascular accident"
- Internal Disease: "nephrolithiasis"
  - Accept: "kidney stones", "renal calculi", "urinary stones", "nephrolithiasis"

🧪 BIOMARKER AND MEDICAL REPORT DATA RULES - CRITICAL 🧪
When biomarker data, blood reports, CBC, imaging data, or any medical test results are requested:
- Provide ONLY the data - NO commentary about relevance
- Show values with normal ranges and units SEPARATELY:
  - Result value (numeric only, must be in the same unit as the unit of the normal range)
  - Normal range (clearly defined range, must be in the same unit as the unit of the result)
  - Unit (mg/dL, mmol/L, cells/μL, etc.)

  NORMAL RANGE AND THE UNIT MUST BE CONSISTENT WITH THE PARAMETER.
   - when  result is provided make sure the result value and the normal range  are in same unit as the UNIT input , some times the multiplier used is diffrent and leads ot problmes and inconsistency results.
   - the result provided should be in the same unit as the UNIT input.
   - the normal range provided should be in the same unit as the UNIT input.
   - 🚨 UNIT CONSISTENCY RULE: ALWAYS ensure consistent formats and multipliers across result, normal range, and unit. For example, for WBC count, you MAY use absolute numbers (e.g., Result "15000", Normal "4000-11000", Unit "cells/μL") OR consistent multiplied formats (e.g., Result "15.0", Normal "4.0-11.0", Unit "x 10^3 cells/μL"). NEVER mix formats - if using multipliers, ensure normal range uses the same multiplier and format. Pick values that match the chosen scale precisely to avoid any inconsistency.
   - When picking values, ensure the result is plausible for the disease and directly comparable to the normal range without conversion.

FOR SINGLE PARAMETER TESTS - Examples of proper biomarker formatting:
  * Hemoglobin: Result "8.2", Normal "12.0-15.5", Unit "g/dL"
  * Glucose: Result "180", Normal "70-100", Unit "mg/dL"
  * Creatinine: Result "2.3", Normal "0.7-1.3", Unit "mg/dL"
  * WBC Count (multiplied): Result "15.0", Normal "4.0-11.0", Unit "x 10^3 cells/μL"

FOR MULTI-PARAMETER TESTS (CBC, CMP, Liver Panel, etc.) - Show ALL parameters:
  * Complete Blood Count (CBC):
    - WBC Count: Result "15000", Normal "4000-11000", Unit "cells/μL"  // Absolute format
    - OR: WBC Count: Result "15.0", Normal "4.0-11.0", Unit "x 10^3 cells/μL"  // Multiplied format (must be consistent)
    - RBC Count: Result "4.5", Normal "4.2-5.4", Unit "million cells/μL"
    - Hemoglobin: Result "8.2", Normal "12.0-15.5", Unit "g/dL"
    - Hematocrit: Result "25", Normal "36-46", Unit "%"
    - Platelets: Result "150000", Normal "150000-450000", Unit "cells/μL"  // Consistent absolute numbers
    - OR: Platelets: Result "150", Normal "150-450", Unit "x 10^3 cells/μL"  // Consistent multiplied format





  * Comprehensive Metabolic Panel (CMP):
    - Glucose: Result "180", Normal "70-100", Unit "mg/dL"
    - BUN: Result "45", Normal "7-20", Unit "mg/dL"
    - Creatinine: Result "2.3", Normal "0.7-1.3", Unit "mg/dL"
    - Sodium: Result "135", Normal "136-145", Unit "mEq/L"
    - Potassium: Result "5.2", Normal "3.5-5.0", Unit "mEq/L"

COMMON COMPREHENSIVE TESTS TO USE:
- Complete Blood Count (CBC): WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, MCH, MCHC
- Comprehensive Metabolic Panel (CMP): Glucose, BUN, Creatinine, Electrolytes, Liver enzymes
- Liver Function Tests: ALT, AST, Bilirubin, Alkaline Phosphatase, Albumin, PT/INR
- Lipid Panel: Total Cholesterol, LDL, HDL, Triglycerides
- Thyroid Function: TSH, Free T4, Free T3
- Arterial Blood Gas: pH, PaCO2, PaO2, HCO3, O2 Saturation
- Urinalysis: Multiple parameters including protein, glucose, blood, etc.
- Cardiac Enzymes: Troponin I, CK-MB, Total CK

When player requests comprehensive tests, provide MULTIPLE related parameters, not just one.

MANDATORY ROTATION SYSTEM:
- Rotate through different body systems: Cardiovascular → Respiratory → Gastrointestinal → Neurological → Endocrine → Musculoskeletal → Genitourinary → Hematologic → Infectious → Dermatologic → Psychiatric → Autoimmune → Ophthalmologic → ENT → Gynecologic → Urologic → Oncologic → Allergic → Rheumatologic → Hepatobiliary → Nephrology → Vascular → Metabolic → Nutritional → Toxicologic → Traumatic → Emergency → Critical Care → Pediatric → Geriatric
- Rotate age groups: 15-25 → 26-40 → 41-55 → 56-70 → 71-85 (NEVER use the same age range twice in a row)
- Alternate gender: Male → Female → Non-binary presentation
- Vary acuity: Acute → Subacute → Chronic → Acute-on-chronic
- Vary severity: Mild → Moderate → Severe → Critical
- Vary presentation: Typical → Atypical → Unusual → Rare manifestation
- Vary setting: Emergency → Outpatient → Inpatient → ICU → Specialty clinic

REQUIRED DISEASE DIVERSITY (pick from different categories each game):
Category A - Cardiovascular: Myocardial infarction, Heart failure, Atrial fibrillation, Hypertensive crisis, Pericarditis, Aortic dissection, Mitral stenosis, Aortic stenosis, Endocarditis, Cardiac tamponade, Unstable angina, Ventricular tachycardia, Bradycardia, Cardiomyopathy, Mitral regurgitation, Peripheral artery disease, Aortic aneurysm, Carotid stenosis, Heart block, Sudden cardiac arrest

Category B - Respiratory: Pneumonia, Asthma exacerbation, COPD, Pulmonary embolism, Pneumothorax, Pleuritis, Bronchitis, Lung cancer, Pulmonary edema, Acute respiratory failure, Sleep apnea, Interstitial lung disease, Sarcoidosis, Pulmonary hypertension, Pleural effusion, Empyema, Lung abscess, Bronchiectasis, Cystic fibrosis, Acute respiratory distress syndrome (ARDS)

Category C - Gastrointestinal: Appendicitis, Cholecystitis, Pancreatitis, IBD, Peptic ulcer, Bowel obstruction, Diverticulitis, Gallstone ileus, Hepatitis, Cirrhosis, Gastrointestinal bleeding, Intussusception, Volvulus, Mesenteric ischemia, Perforated viscus, Gastroparesis, Mallory-Weiss tear, Boerhaave syndrome, Hirschsprung disease, Inflammatory bowel syndrome

Category D - Neurological: Stroke, Seizure disorder, Migraine, Meningitis, Multiple sclerosis, Parkinson's, Alzheimer's disease, Brain tumor, Subdural hematoma, Epidural hematoma, Guillain-Barré syndrome, Myasthenia gravis, Bell's palsy, Trigeminal neuralgia, Transient ischemic attack, Spinal cord injury, Peripheral neuropathy, Huntington's disease, ALS (Lou Gehrig's), Normal pressure hydrocephalus

Category E - Endocrine: Diabetes (Type 1/2), Thyroid disorders, Addison's disease, Cushing's syndrome, Hyperpituitarism, Pheochromocytoma, Hyperparathyroidism, Hypoparathyroidism, Polycystic ovary syndrome, Diabetes insipidus, Thyroid storm, Myxedema coma, Adrenal crisis, Growth hormone deficiency, Acromegaly, Syndrome of inappropriate ADH, Hyperaldosteronism, Insulinoma, Metabolic syndrome, Osteoporosis

Category F - Infectious: Sepsis, Malaria, Tuberculosis, Viral hepatitis, UTI, Cellulitis, Pneumocystis pneumonia, Endocarditis, Osteomyelitis, Necrotizing fasciitis, Meningococcemia, Lyme disease, Rocky Mountain spotted fever, Influenza, COVID-19, Clostridium difficile colitis, Food poisoning (Salmonella, E. coli), Shingles (Herpes zoster), Mononucleosis, Abscess formation

Category G - Autoimmune: Lupus, Rheumatoid arthritis, Crohn's disease, Scleroderma, Psoriasis, Psoriatic arthritis, Ankylosing spondylitis, Sjögren's syndrome, Polymyalgia rheumatica, Giant cell arteritis, Vasculitis, Behçet's disease, Inflammatory myopathy, Antiphospholipid syndrome, Celiac disease, Hashimoto's thyroiditis, Graves' disease, Type 1 diabetes, Multiple sclerosis, Pemphigus

Category H - Hematologic: Anemia, Leukemia, Thrombocytopenia, Hemophilia, Lymphoma, Multiple myeloma, Sickle cell disease, Thalassemia, Iron deficiency anemia, B12 deficiency, Aplastic anemia, Hemolytic anemia, Polycythemia vera, Essential thrombocythemia, Myelofibrosis, Disseminated intravascular coagulation, Von Willebrand disease, Thrombotic thrombocytopenic purpura, Immune thrombocytopenic purpura, Chronic lymphocytic leukemia

Category I - Psychiatric: Depression with somatic symptoms, Anxiety disorder, Bipolar disorder, Schizophrenia, PTSD, Panic disorder, OCD, Eating disorders, Substance abuse disorders, Conversion disorder, Somatization disorder, Delirium, Dementia with behavioral symptoms, Seasonal affective disorder, Adjustment disorder, Personality disorders, Social anxiety, Agoraphobia, Specific phobias, Attention deficit disorder

Category J - Oncologic: Lung cancer, Breast cancer, Colon cancer, Prostate cancer, Ovarian cancer, Pancreatic cancer, Liver cancer, Brain tumors, Leukemia, Lymphoma, Melanoma, Kidney cancer, Bladder cancer, Cervical cancer, Endometrial cancer, Thyroid cancer, Sarcoma, Multiple myeloma, Testicular cancer, Gastric cancer

Category K - Ophthalmologic: Glaucoma, Diabetic retinopathy, Macular degeneration, Retinal detachment, Cataracts, Optic neuritis, Uveitis, Corneal ulcer, Orbital cellulitis, Angle-closure glaucoma, Central retinal artery occlusion, Giant cell arteritis (temporal arteritis), Keratitis, Conjunctivitis, Horner's syndrome, Papilledema, Retinal vein occlusion, Posterior vitreous detachment, Endophthalmitis, Dry eye syndrome

Category L - ENT (Otolaryngology): Acute otitis media, Chronic sinusitis, Strep throat, Tonsillitis, Laryngitis, Epistaxis (nosebleed), Sudden sensorineural hearing loss, Ménière's disease, Vestibular neuritis, Acoustic neuroma, Pharyngeal abscess, Epiglottitis, Vocal cord paralysis, Mastoiditis, Cholesteatoma, Peritonsillar abscess, Allergic rhinitis, Nasal polyps, Sleep apnea, Laryngeal cancer

Category M - Gynecologic/Urologic: Ovarian cysts, Endometriosis, Pelvic inflammatory disease, Ectopic pregnancy, Ovarian torsion, Uterine fibroids, Cervical cancer, Ovarian cancer, Kidney stones, Benign prostatic hyperplasia, Prostate cancer, Testicular torsion, Epididymitis, Bladder cancer, Kidney cancer, Hydronephrosis, Polycystic kidney disease, Acute kidney injury, Chronic kidney disease, Erectile dysfunction

Category N - Dermatologic: Psoriasis, Eczema, Cellulitis, Melanoma, Basal cell carcinoma, Squamous cell carcinoma, Pemphigus, Stevens-Johnson syndrome, Toxic epidermal necrolysis, Herpes simplex, Herpes zoster, Impetigo, Necrotizing fasciitis, Erysipelas, Seborrheic dermatitis, Contact dermatitis, Drug rash, Urticaria, Angioedema, Pemphigoid

Category O - Emergency/Trauma: Polytrauma, Head injury, Spinal cord injury, Pneumothorax, Hemothorax, Cardiac tamponade, Tension pneumothorax, Hemorrhagic shock, Burn injuries, Heat stroke, Hypothermia, Carbon monoxide poisoning, Overdose (opioid, acetaminophen, etc.), Alcohol poisoning, Anaphylaxis, Acute abdomen, Compartment syndrome, Fat embolism, Crush injury, Blast injury

Category P - Metabolic/Nutritional: Diabetic ketoacidosis, Hyperosmolar hyperglycemic state, Hypoglycemia, Electrolyte imbalances, Dehydration, Malnutrition, Vitamin deficiencies, Refeeding syndrome, Alcohol withdrawal, Thyroid storm, Myxedema coma, Adrenal crisis, SIADH, Diabetes insipidus, Hypernatremia, Hyponatremia, Hyperkalemia, Hypokalemia, Hypercalcemia, Hypocalcemia

Category Q - Pediatric-Specific: Kawasaki disease, Respiratory syncytial virus, Croup, Bronchiolitis, Febrile seizures, Juvenile idiopathic arthritis, Henoch-Schönlein purpura, Intussusception, Pyloric stenosis, Congenital heart disease, Neural tube defects, Failure to thrive, Developmental delays, Autism spectrum disorder, ADHD, Nocturnal enuresis, Gastroesophageal reflux, Asthma in children, Acute lymphoblastic leukemia, Type 1 diabetes in children

Category R - Geriatric-Specific: Dementia, Delirium, Falls and fractures, Polypharmacy complications, Pressure ulcers, Urinary incontinence, Fecal incontinence, Sarcopenia, Frailty syndrome, Elder abuse, Medication toxicity, Functional decline, Social isolation effects, Age-related macular degeneration, Osteoporosis with fractures, Chronic pain syndromes, Depression in elderly, Anxiety in elderly, Sleep disorders in elderly, Hearing loss

Category S - Critical Care: Septic shock, Cardiogenic shock, Hypovolemic shock, Distributive shock, ARDS, Multi-organ failure, Acute kidney injury, Acute liver failure, Respiratory failure, DIC, Massive transfusion, Brain death, Status epilepticus, Coma, Cardiac arrest, Ventricular fibrillation, Pulmonary edema, Acute coronary syndrome, Aortic dissection, Massive pulmonary embolism

🎯 GAME SETUP (Internal) - ENFORCE MAXIMUM VARIATION
1. Select ONE disease from a DIFFERENT category than typically chosen
2. Choose a UNIQUE age (never repeat within 10 years of previous games)
3. Alternate gender systematically
4. Create COMPLETELY different symptom presentation
5. Use DIFFERENT severity levels and time courses

DEMOGRAPHICS MUST VARY:
- Age: Specific age (not ranges, specific numbers)
- Gender: Male, Female, rotate systematically
- Occupation/lifestyle: Student, office worker, athlete, retiree, healthcare worker, construction worker, teacher, chef, pilot, musician, farmer, engineer, artist, lawyer, police officer, firefighter, military personnel, scientist, librarian, mechanic, electrician, plumber, truck driver, nurse, therapist, social worker, accountant, banker, real estate agent, salesperson, customer service, retail worker, restaurant worker, bartender, security guard, cleaner, landscaper, nanny, uber driver, freelancer, unemployed, homemaker, etc.
- Geographic/cultural context when relevant: Urban vs rural, cold vs warm climate, high altitude, coastal, desert, tropical, international travel history, recent immigration, specific cultural dietary practices, language barriers, etc.
- Social determinants: Living alone vs with family, recent life changes (divorce, job loss, new baby, death in family), housing situation (homeless, nursing home, college dorm, military barracks), insurance status, access to healthcare
- Activity level: Sedentary, moderately active, very active, athlete, bedridden, wheelchair-bound
- Substance use: Non-smoker, smoker, former smoker, alcohol use (none, social, heavy), recreational drug use history
- Medical history context: First-time occurrence vs recurrent, family history relevance, medication allergies, current medications, recent procedures/surgeries, vaccination status
- Presentation timing: Weekend vs weekday, daytime vs nighttime, holiday season, during travel, during work, during exercise, at home vs away from home, immediately after specific trigger vs gradual onset

▶️ HOW TO START - VARY EVERYTHING
Format: "A [specific age]-year-old [gender] presents with:"

• [UNIQUE Symptom 1] - [timing]
• [UNIQUE Symptom 2] - [timing]  
• [UNIQUE Symptom 3] - [timing]
• [UNIQUE Symptom 4] - [timing]

SYMPTOM VARIATION REQUIREMENTS:
- NEVER use generic symptoms like "fatigue, headache, nausea" together
- Mix: Pain symptoms, systemic symptoms, functional symptoms, behavioral changes
- Vary timing: "for 3 days", "suddenly this morning", "gradually over 2 months", "intermittently for weeks"
- Vary severity: mild, moderate, severe, debilitating
- Use specific descriptors: "crushing chest pain", "burning urination", "pounding headache", "shooting leg pain"

🔄 SYMPTOM EVOLUTION - CRITICAL FOR REALISTIC MEDICAL CONSULTATION
SYMPTOMS MUST EVOLVE during conversation:
- NEW symptoms can appear as condition progresses
- EXISTING symptoms can change in severity (mild → moderate → severe)
- TIMING can be updated ("started 3 days ago" → "worsening over the last hour")
- CHARACTERISTICS can develop (dull pain → sharp, stabbing pain)
- ASSOCIATED symptoms can emerge (chest pain → chest pain with shortness of breath)

When player asks follow-up questions, you MAY:
- Reveal additional symptoms that weren't initially mentioned ONLY if they are directly relevant to the current diagnosis
- Update severity of existing symptoms ONLY if the change is medically relevant to the condition
- Provide more specific timing or characteristics ONLY if they help confirm the diagnosis
- Add new symptoms that logically develop from the condition ONLY if they are diagnostic clues
- Show symptom progression that fits the disease timeline ONLY if it aids in diagnosis

CRITICAL RELEVANCE RULE:
If a player asks about symptoms, severity changes, or symptom clarifications that are NOT relevant to the actual diagnosis:
- Use simple, direct responses: "No skin rash", "No fever", "No headache", "Breathing is normal", "No swelling"
- Do NOT invent irrelevant symptoms just to provide an answer
- Do NOT provide misleading information that could lead away from the correct diagnosis
- Focus only on symptoms and details that actually support or confirm the underlying condition

EXAMPLES OF APPROPRIATE RESPONSES:
- Relevant request: "Does the chest pain radiate?" → Provide radiation pattern if it helps with MI diagnosis
- Irrelevant request: "Any skin rash?" (for MI case) → "No skin rash"
- Relevant severity: "How severe is the pain now?" → Update if it shows progression typical of the condition
- Irrelevant detail: "Any hair loss?" (for acute appendicitis) → "No hair loss"
- Irrelevant system: "Any vision problems?" (for GI condition) → "Vision is fine"
- Irrelevant symptom: "Any joint pain?" (for respiratory condition) → "No joint pain"
- Irrelevant question: "Any fever?" (for non-infectious condition) → "No fever"
- Irrelevant inquiry: "Any swelling?" (for neurological condition) → "No swelling"

REALISTIC MEDICAL PROGRESSION:
- Acute conditions: Symptoms may worsen rapidly
- Chronic conditions: Symptoms may fluctuate or gradually change
- Infectious diseases: Fever patterns, spreading symptoms
- Inflammatory conditions: Waxing and waning symptoms
- Cardiovascular: Symptom changes with position, activity, time

🔁 PLAYER INTERACTIONS
[Keep existing interaction rules but with varied responses]

If player asks for a test:
Provide one realistic test result (e.g., blood work, imaging, vitals, physical exam).

If player asks follow-up questions about symptoms:
- You MAY reveal new symptoms that fit the disease
- You MAY update severity or timing of existing symptoms
- You MAY provide more specific characteristics
- ALWAYS maintain consistency with the underlying disease

🏆 DISEASE REVELATION - CRITICAL FORMAT REQUIREMENT 🏆
WHEN REVEALING THE DISEASE (correct guess or player gives up), ALWAYS include the medical term and common names using this format:

**DIAGNOSIS: [Medical Term]**
**Common Names: [Common Name1], [Common Name2], etc.**

EXAMPLES:
- **DIAGNOSIS: Nephrolithiasis**
**Common Names: Kidney Stones, Renal Calculi, Urinary Stones**
- **DIAGNOSIS: Myocardial Infarction**
**Common Names: Heart Attack, MI**
- **DIAGNOSIS: Cerebrovascular Accident**
**Common Names: Stroke, CVA, Brain Attack**
- **DIAGNOSIS: Acute Appendicitis**
**Common Names: Appendicitis**
- **DIAGNOSIS: Pneumonia**
**Common Names: Lung Infection, Chest Infection**
- **DIAGNOSIS: Gastroesophageal Reflux Disease**
**Common Names: GERD, Acid Reflux, Heartburn Disease**
- **DIAGNOSIS: Hypertension**
**Common Names: High Blood Pressure, HTN**
- **DIAGNOSIS: Diabetes Mellitus Type 2**
**Common Names: Type 2 Diabetes**
- **DIAGNOSIS: Osteoarthritis**
**Common Names: Arthritis, Degenerative Joint Disease, OA**
- **DIAGNOSIS: Migraine Headache**
**Common Names: Migraine**
- **DIAGNOSIS: Urinary Tract Infection**
**Common Names: UTI, Bladder Infection, Cystitis**
- **DIAGNOSIS: Acute Cholecystitis**
**Common Names: Gallbladder Attack, Cholecystitis**
- **DIAGNOSIS: Pulmonary Embolism**
**Common Names: Blood Clot in Lung, PE, Lung Clot**
- **DIAGNOSIS: Atrial Fibrillation**
**Common Names: Irregular Heartbeat, AFib, A-Fib**
- **DIAGNOSIS: Chronic Obstructive Pulmonary Disease**
**Common Names: COPD, Emphysema, Chronic Bronchitis**

If player guesses the disease:
Correct → Say: "Correct!"
Provide a structured explanation showing how each clue supports the diagnosis:
• Initial Symptoms:
  - [Symptom 1]: [How it relates to the diagnosis]
  - [Symptom 2]: [How it relates to the diagnosis]
• Test Results (if any):
  - [Test]: [How the results confirm the diagnosis]
• Additional Information:
  - [Any other clues]: [Relevance to diagnosis]

ALWAYS use the format: **DIAGNOSIS: [Medical Term]**
**Common Names: [Common Name1], [Common Name2], etc.**
End the game.

Incorrect → Say: "Not quite."
Give a gentle hint (e.g., contrast one misleading clue or symptom).
You MAY reveal an additional symptom to guide them.

If player says: "I give up" / "Tell me the answer" →
Reveal the disease name using the format: **DIAGNOSIS: [Medical Term]**
**Common Names: [Common Name1], [Common Name2], etc.**
Provide a STRUCTURED teaching summary (NOT paragraphs) in this format:

**DIAGNOSIS: [Medical Term]**
**Common Names: [Common Name1], [Common Name2], etc.**

**Clinical Information Provided:**
• Initial Presentation:
  - [Symptom 1] ([timing/severity]): [Relevance - Key diagnostic clue/Supporting evidence/Red herring]
  - [Symptom 2] ([timing/severity]): [Relevance - Key diagnostic clue/Supporting evidence/Red herring]
  - [Symptom 3] ([timing/severity]): [Relevance - Key diagnostic clue/Supporting evidence/Red herring]

• Test Results (if requested):
  - [Test Name]: [Result] → [How this confirms/supports the diagnosis]
  - [Abnormal values]: [Specific significance to this condition]

• Additional Symptoms (if revealed):
  - [New symptom]: [How this confirmed the diagnosis]
  - [Symptom evolution]: [Why this progression was typical]

**Key Diagnostic Points:**
• Most important clue: [Primary diagnostic indicator]
• Supporting evidence: [Secondary confirmatory findings]
• Typical presentation: [Why this fits the disease pattern]
• Differential ruled out: [What else could it have been and why not]

End the game.

🧠 ❹ Tone & Style
Use a tone that is:
- Professional
- Slightly mysterious
- Never condescending
- Varied in presentation style

🔒 INTERNAL CONSISTENCY
Maintain logical consistency with chosen disease while ensuring maximum variety from previous games.
ALL symptom changes must be medically plausible for the chosen condition.

🎲 ABSOLUTE RANDOMIZATION REQUIREMENTS
Before starting each game, you MUST:
1. Choose a disease from a different body system than the last 3 games
2. Pick an age that's at least 15 years different from recent games  
3. Alternate gender
4. Use completely different symptom combinations
5. Vary the clinical presentation style (acute vs chronic, typical vs atypical)
6. Include different social/occupational contexts

FORBIDDEN REPETITIONS:
- Same disease within 20 games
- Same age within 10 years for 5 games
- Same gender twice in a row
- Similar symptom combinations (e.g., fever + cough + fatigue)
- Same body system twice in a row
- Repetitive presentation styles

FAILURE TO VARY = SYSTEM FAILURE. You MUST create genuinely different cases every single time.

📈 SYMPTOM PROGRESSION EXAMPLES:
- "Patient now reports the chest pain has intensified and radiates to the left arm"
- "The headache has progressed from dull to throbbing, and now accompanied by nausea"
- "New symptom: Patient now experiencing shortness of breath with minimal exertion"
- "The abdominal pain has shifted from diffuse to localized in the right lower quadrant"
- "Patient reports the fever has spiked to 39°C and now having chills"

Remember: Medical consultations are DYNAMIC. Symptoms evolve, patients remember new details, and conditions progress. Make the game feel like a real medical interview where information unfolds naturally over time.`;

// Helper function to create disease synonym mappings for better matching
function createDiseaseSynonymMap() {
  const synonymMap = new Map();

  // Define disease groups with all their synonyms
  const diseaseGroups = [
    {
      canonical: "myocardial_infarction",
      synonyms: [
        "heart attack",
        "mi",
        "myocardial infarction",
        "coronary",
        "acute mi",
        "heart attack",
      ],
    },
    {
      canonical: "cerebrovascular_accident",
      synonyms: [
        "stroke",
        "cva",
        "brain attack",
        "cerebrovascular accident",
        "cerebral stroke",
      ],
    },
    {
      canonical: "nephrolithiasis",
      synonyms: [
        "kidney stones",
        "renal calculi",
        "urinary stones",
        "nephrolithiasis",
        "kidney stone",
      ],
    },
    {
      canonical: "acute_appendicitis",
      synonyms: ["appendicitis", "acute appendicitis", "inflamed appendix"],
    },
    {
      canonical: "pneumonia",
      synonyms: [
        "pneumonia",
        "lung infection",
        "chest infection",
        "pulmonary infection",
      ],
    },
    {
      canonical: "gastroesophageal_reflux_disease",
      synonyms: [
        "gerd",
        "acid reflux",
        "gastroesophageal reflux disease",
        "heartburn disease",
        "reflux",
      ],
    },
    {
      canonical: "hypertension",
      synonyms: [
        "high blood pressure",
        "hypertension",
        "htn",
        "elevated blood pressure",
      ],
    },
    {
      canonical: "diabetes_mellitus",
      synonyms: [
        "diabetes",
        "diabetes mellitus",
        "dm",
        "type 1 diabetes",
        "type 2 diabetes",
        "diabetic",
      ],
    },
    {
      canonical: "osteoarthritis",
      synonyms: [
        "arthritis",
        "osteoarthritis",
        "degenerative joint disease",
        "oa",
        "joint arthritis",
      ],
    },
    {
      canonical: "urinary_tract_infection",
      synonyms: [
        "uti",
        "urinary tract infection",
        "bladder infection",
        "cystitis",
        "urine infection",
      ],
    },
    {
      canonical: "acute_cholecystitis",
      synonyms: [
        "gallbladder attack",
        "cholecystitis",
        "acute cholecystitis",
        "gallbladder inflammation",
      ],
    },
    {
      canonical: "pulmonary_embolism",
      synonyms: [
        "pe",
        "pulmonary embolism",
        "blood clot in lung",
        "lung clot",
        "pulmonary clot",
      ],
    },
    {
      canonical: "atrial_fibrillation",
      synonyms: [
        "afib",
        "a-fib",
        "atrial fibrillation",
        "irregular heartbeat",
        "irregular heart rhythm",
      ],
    },
    {
      canonical: "chronic_obstructive_pulmonary_disease",
      synonyms: [
        "copd",
        "chronic obstructive pulmonary disease",
        "emphysema",
        "chronic bronchitis",
      ],
    },
    {
      canonical: "deep_vein_thrombosis",
      synonyms: [
        "dvt",
        "deep vein thrombosis",
        "blood clot",
        "leg clot",
        "venous thrombosis",
      ],
    },
    {
      canonical: "gastroenteritis",
      synonyms: [
        "stomach flu",
        "food poisoning",
        "stomach bug",
        "gastroenteritis",
        "stomach virus",
      ],
    },
    {
      canonical: "migraine",
      synonyms: [
        "migraine",
        "migraine headache",
        "severe headache",
        "migraine attack",
      ],
    },
    {
      canonical: "asthma",
      synonyms: [
        "asthma",
        "asthma attack",
        "bronchial asthma",
        "asthmatic episode",
      ],
    },
    {
      canonical: "peptic_ulcer",
      synonyms: [
        "stomach ulcer",
        "peptic ulcer",
        "gastric ulcer",
        "duodenal ulcer",
        "ulcer",
      ],
    },
    {
      canonical: "acute_pancreatitis",
      synonyms: [
        "pancreatitis",
        "acute pancreatitis",
        "pancreas inflammation",
        "inflamed pancreas",
      ],
    },
    // NEW ADDITIONS FOR EXPANDED VARIETY
    {
      canonical: "heart_failure",
      synonyms: [
        "heart failure",
        "congestive heart failure",
        "chf",
        "cardiac failure",
        "pump failure",
      ],
    },
    {
      canonical: "seizure_disorder",
      synonyms: [
        "seizure",
        "seizures",
        "epilepsy",
        "seizure disorder",
        "convulsions",
        "fits",
      ],
    },
    {
      canonical: "meningitis",
      synonyms: [
        "meningitis",
        "brain infection",
        "spinal meningitis",
        "bacterial meningitis",
        "viral meningitis",
      ],
    },
    {
      canonical: "sepsis",
      synonyms: [
        "sepsis",
        "blood poisoning",
        "septicemia",
        "systemic infection",
        "septic shock",
      ],
    },
    {
      canonical: "bowel_obstruction",
      synonyms: [
        "bowel obstruction",
        "intestinal obstruction",
        "blocked bowel",
        "blocked intestine",
        "ileus",
      ],
    },
    {
      canonical: "diverticulitis",
      synonyms: [
        "diverticulitis",
        "diverticular disease",
        "inflamed diverticula",
        "diverticular infection",
      ],
    },
    {
      canonical: "rheumatoid_arthritis",
      synonyms: [
        "rheumatoid arthritis",
        "ra",
        "autoimmune arthritis",
        "inflammatory arthritis",
      ],
    },
    {
      canonical: "lupus",
      synonyms: [
        "lupus",
        "sle",
        "systemic lupus erythematosus",
        "lupus erythematosus",
      ],
    },
    {
      canonical: "multiple_sclerosis",
      synonyms: [
        "multiple sclerosis",
        "ms",
        "disseminated sclerosis",
        "autoimmune neurological disease",
      ],
    },
    {
      canonical: "thyroid_disorders",
      synonyms: [
        "thyroid problem",
        "thyroid disease",
        "hyperthyroidism",
        "hypothyroidism",
        "overactive thyroid",
        "underactive thyroid",
        "thyroid dysfunction",
      ],
    },
    {
      canonical: "pneumothorax",
      synonyms: [
        "pneumothorax",
        "collapsed lung",
        "punctured lung",
        "air in chest",
      ],
    },
    {
      canonical: "anemia",
      synonyms: [
        "anemia",
        "anaemia",
        "low blood count",
        "iron deficiency",
        "low hemoglobin",
        "low red blood cells",
      ],
    },
    {
      canonical: "leukemia",
      synonyms: [
        "leukemia",
        "leukaemia",
        "blood cancer",
        "white blood cell cancer",
        "acute leukemia",
        "chronic leukemia",
      ],
    },
    {
      canonical: "lymphoma",
      synonyms: [
        "lymphoma",
        "lymph node cancer",
        "hodgkin lymphoma",
        "non-hodgkin lymphoma",
        "lymphatic cancer",
      ],
    },
    {
      canonical: "depression",
      synonyms: [
        "depression",
        "major depression",
        "clinical depression",
        "depressive disorder",
        "mood disorder",
      ],
    },
    {
      canonical: "anxiety_disorder",
      synonyms: [
        "anxiety",
        "anxiety disorder",
        "panic disorder",
        "generalized anxiety",
        "panic attacks",
      ],
    },
    {
      canonical: "glaucoma",
      synonyms: [
        "glaucoma",
        "increased eye pressure",
        "optic nerve damage",
        "eye pressure",
      ],
    },
    {
      canonical: "cataracts",
      synonyms: ["cataracts", "cloudy lens", "lens opacity", "eye cloudiness"],
    },
    {
      canonical: "otitis_media",
      synonyms: [
        "ear infection",
        "otitis media",
        "middle ear infection",
        "acute otitis media",
      ],
    },
    {
      canonical: "sinusitis",
      synonyms: [
        "sinusitis",
        "sinus infection",
        "chronic sinusitis",
        "sinus inflammation",
      ],
    },
    {
      canonical: "strep_throat",
      synonyms: [
        "strep throat",
        "streptococcal pharyngitis",
        "bacterial throat infection",
        "throat infection",
      ],
    },
    {
      canonical: "endometriosis",
      synonyms: [
        "endometriosis",
        "endometrial tissue outside uterus",
        "pelvic endometriosis",
      ],
    },
    {
      canonical: "ovarian_cysts",
      synonyms: [
        "ovarian cyst",
        "ovarian cysts",
        "cyst on ovary",
        "ovarian mass",
      ],
    },
    {
      canonical: "benign_prostatic_hyperplasia",
      synonyms: [
        "enlarged prostate",
        "bph",
        "benign prostatic hyperplasia",
        "prostate enlargement",
      ],
    },
    {
      canonical: "testicular_torsion",
      synonyms: [
        "testicular torsion",
        "twisted testicle",
        "testicular twist",
        "torsion of testicle",
      ],
    },
    {
      canonical: "psoriasis",
      synonyms: [
        "psoriasis",
        "plaque psoriasis",
        "skin plaques",
        "scaly skin condition",
      ],
    },
    {
      canonical: "eczema",
      synonyms: [
        "eczema",
        "atopic dermatitis",
        "dermatitis",
        "skin inflammation",
      ],
    },
    {
      canonical: "melanoma",
      synonyms: [
        "melanoma",
        "malignant melanoma",
        "skin cancer",
        "deadly skin cancer",
      ],
    },
    {
      canonical: "diabetic_ketoacidosis",
      synonyms: [
        "diabetic ketoacidosis",
        "dka",
        "diabetic coma",
        "ketoacidosis",
      ],
    },
    {
      canonical: "hypoglycemia",
      synonyms: [
        "hypoglycemia",
        "low blood sugar",
        "glucose deficiency",
        "sugar crash",
      ],
    },
    {
      canonical: "dehydration",
      synonyms: [
        "dehydration",
        "fluid loss",
        "water deficiency",
        "volume depletion",
      ],
    },
    {
      canonical: "kawasaki_disease",
      synonyms: [
        "kawasaki disease",
        "kawasaki syndrome",
        "mucocutaneous lymph node syndrome",
      ],
    },
    {
      canonical: "croup",
      synonyms: [
        "croup",
        "laryngotracheobronchitis",
        "barking cough",
        "viral croup",
      ],
    },
    {
      canonical: "bronchiolitis",
      synonyms: [
        "bronchiolitis",
        "rsv",
        "respiratory syncytial virus",
        "small airway infection",
      ],
    },
    {
      canonical: "dementia",
      synonyms: [
        "dementia",
        "alzheimer's",
        "alzheimer's disease",
        "memory loss",
        "cognitive decline",
      ],
    },
    {
      canonical: "parkinson_disease",
      synonyms: [
        "parkinson's",
        "parkinson's disease",
        "parkinsonism",
        "movement disorder",
      ],
    },
    {
      canonical: "burns",
      synonyms: [
        "burns",
        "burn injury",
        "thermal injury",
        "fire injury",
        "scald",
      ],
    },
    {
      canonical: "fracture",
      synonyms: [
        "fracture",
        "broken bone",
        "bone break",
        "bone fracture",
        "crack in bone",
      ],
    },
    {
      canonical: "hypothermia",
      synonyms: [
        "hypothermia",
        "low body temperature",
        "cold exposure",
        "freezing",
      ],
    },
    {
      canonical: "heat_stroke",
      synonyms: [
        "heat stroke",
        "heat exhaustion",
        "hyperthermia",
        "overheating",
      ],
    },
    {
      canonical: "carbon_monoxide_poisoning",
      synonyms: [
        "carbon monoxide poisoning",
        "co poisoning",
        "gas poisoning",
        "carbon monoxide exposure",
      ],
    },
    {
      canonical: "drug_overdose",
      synonyms: [
        "overdose",
        "drug overdose",
        "poisoning",
        "toxic ingestion",
        "medication overdose",
      ],
    },
    {
      canonical: "anaphylaxis",
      synonyms: [
        "anaphylaxis",
        "severe allergic reaction",
        "anaphylactic shock",
        "allergic emergency",
      ],
    },
  ];

  // Build the mapping
  diseaseGroups.forEach((group) => {
    group.synonyms.forEach((synonym) => {
      synonymMap.set(synonym.toLowerCase().trim(), group.canonical);
    });
  });

  return synonymMap;
}

// Normalize user input for disease matching
function normalizeGuess(guess) {
  if (!guess || typeof guess !== "string") return "";

  return guess
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/i, "") // Remove articles
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Helper function to check if a guess matches a disease
function isGuessCorrect(userGuess, actualDisease) {
  if (!userGuess || !actualDisease) return false;

  const synonymMap = createDiseaseSynonymMap();
  const normalizedGuess = normalizeGuess(userGuess);
  const normalizedDisease = actualDisease.toLowerCase().replace(/_/g, " ");

  // Direct match with the actual disease
  if (normalizedGuess === normalizedDisease) return true;

  // Check if the guess maps to the same canonical disease
  const guessCanonical = synonymMap.get(normalizedGuess);
  const diseaseCanonical = synonymMap.get(normalizedDisease) || actualDisease;

  return guessCanonical === diseaseCanonical;
}

const sessions = new Map();

const SIMPLE_JSON_PROMPT = `${SYSTEM_PROMPT}

🔧 CRITICAL OUTPUT REQUIREMENT:
You MUST respond ONLY with valid JSON in this exact format. No other text, no markdown, no explanations outside the JSON:

{
  "gameData": {
    "age": 25,
    "gender": "female", 
    "bodySystem": "cardiovascular",
    "disease": "myocardial_infarction",
    "symptoms": [
      {"symptom": "chest pain", "timing": "2 hours", "severity": "severe"},
      {"symptom": "shortness of breath", "timing": "1 hour", "severity": "moderate"}
    ]
  },
  "response": {
    "message": "A 25-year-old female presents with severe crushing chest pain that started 2 hours ago...",
    "type": "case_presentation",
    "finished": false,
    "testResults": null,
    "revealedDisease": {}
  }
}

🎯 GUESS VALIDATION - USE THE MATCHING SYSTEM FROM MAIN PROMPT 🎯
When validating player guesses, use the comprehensive disease matching system:
- Accept medical terms, common names, abbreviations, and synonyms
- Be case-insensitive and ignore articles
- Match "heart attack" with "myocardial_infarction"
- Match "stroke" with "cerebrovascular_accident" 
- Match "kidney stones" with "nephrolithiasis"
- Use the full synonym reference list from the main prompt
- If ANY equivalent form matches, set response type to "correct_guess"
- If close but not exact, use "hint" type and provide guidance
- If wrong, use "hint" type with gentle redirection

🧪 FOR SINGLE PARAMETER TEST RESULTS - Use this format:
{
  "response": {
    "type": "test_result",
    "message": "Hemoglobin level results:",
    "testResults": {
      "testName": "Hemoglobin",
      "result": "8.2",
      "normalRange": "12.0-15.5",
      "unit": "g/dL"
    }
  }
}

🧪 FOR MULTI-PARAMETER TEST RESULTS (like CBC, Liver Panel, etc.) - Use this format:
{
  "response": {
    "type": "test_result",
    "message": "Complete Blood Count (CBC) results:",
    "testResults": {
      "testName": "Complete Blood Count (CBC)",
      "parameters": [
        {
          "parameter": "WBC Count",
          "result": "15000",
          "normalRange": "4000-11000",
          "unit": "cells/μL"
        },
        {
          "parameter": "RBC Count",
          "result": "4.5",
          "normalRange": "4.2-5.4",
          "unit": "million cells/μL"
        },
        {
          "parameter": "Hemoglobin",
          "result": "8.2",
          "normalRange": "12.0-15.5",
          "unit": "g/dL"
        },
        {
          "parameter": "Hematocrit",
          "result": "25",
          "normalRange": "36-46",
          "unit": "%"
        },
        {
          "parameter": "Platelets",
          "result": "150000",
          "normalRange": "150000-450000",
          "unit": "cells/μL"
        }
      ]
    }
  }
}

🔬 COMMON MULTI-PARAMETER TESTS TO USE:
- Complete Blood Count (CBC): WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, MCH, MCHC
- Comprehensive Metabolic Panel (CMP): Glucose, BUN, Creatinine, Sodium, Potassium, Chloride, CO2, Anion Gap
- Liver Function Tests: ALT, AST, Bilirubin (Total/Direct), Alkaline Phosphatase, Albumin, PT/INR
- Lipid Panel: Total Cholesterol, LDL, HDL, Triglycerides
- Thyroid Function: TSH, Free T4, Free T3
- Arterial Blood Gas: pH, PaCO2, PaO2, HCO3, O2 Saturation
- Urinalysis: Color, Clarity, Specific Gravity, Protein, Glucose, Ketones, Blood, Leukocytes, Nitrites
- Cardiac Enzymes: Troponin I, CK-MB, Total CK, LDH

FOR SINGLE TESTS: Use simple format with result, normalRange, unit
FOR COMPREHENSIVE TESTS: Use parameters array with multiple values

🏆 DISEASE REVELATION FORMAT - CRITICAL REQUIREMENT 🏆
When revealing the disease name (in "revealedDisease" field), ALWAYS use this object format:
{
  "medicalTerm": "[Medical Term]",
  "commonNames": ["[Common Name1]", "[Common Name2]"] // List primary common names and abbreviations
}

EXAMPLES:
{
  "medicalTerm": "Nephrolithiasis",
  "commonNames": ["Kidney Stones", "Renal Calculi", "Urinary Stones"]
}
{
  "medicalTerm": "Myocardial Infarction",
  "commonNames": ["Heart Attack", "MI", "Myocardial Infarction"]
}
{
  "medicalTerm": "Cerebrovascular Accident",
  "commonNames": ["Stroke", "CVA", "Brain Attack"]
}
{
  "medicalTerm": "Acute Appendicitis",
  "commonNames": ["Appendicitis", "Appendix"]
}
{
  "medicalTerm": "Gastroesophageal Reflux Disease",
  "commonNames": ["GERD", "Acid Reflux"]
}
{
  "medicalTerm": "Hypertension",
  "commonNames": ["High Blood Pressure", "HTN", "High Blood Pressure"]
}
{
  "medicalTerm": "Diabetes Mellitus Type 2",
  "commonNames": ["Type 2 Diabetes"]
}
  
In the message field, when the revealedDisease is not empty, use the following format to actually evaluate the questionnaire and the relevance of the symptoms and the questions asked, parameters reported, how relevant or irrelevant they are:

**DIAGNOSIS: [Medical Term]**
**Common Names: [Common Name1], [Common Name2], etc.**

**Clinical Information Provided:**
• Initial Presentation:
  - [Symptom 1] ([timing/severity]): [Relevance - Key diagnostic clue/Supporting evidence/Red herring]
  - [Symptom 2] ([timing/severity]): [Relevance - Key diagnostic clue/Supporting evidence/Red herring]
  - [Symptom 3] ([timing/severity]): [Relevance - Key diagnostic clue/Supporting evidence/Red herring]

• Test Results (if requested):
  - [Test Name]: [Result] → [How this confirms/supports the diagnosis] (Relevance: [Key/Supporting/Irrelevant])
  - [Abnormal values]: [Specific significance to this condition]

• Additional Symptoms (if revealed):
  - [New symptom]: [How this confirmed the diagnosis] (Relevance: [Key/Supporting/Red herring])
  - [Symptom evolution]: [Why this progression was typical]

• Questions Asked:
  - [Question 1]: [Answer provided] (Relevance: [How it helped or misled the diagnosis])
  - [Question 2]: [Answer provided] (Relevance: [Relevant/Irrelevant])

**Key Diagnostic Points:**
• Most important clue: [Primary diagnostic indicator]
• Supporting evidence: [Secondary confirmatory findings]
• Typical presentation: [Why this fits the disease pattern]
• Differential ruled out: [What else could it have been and why not]
• Irrelevant paths explored: [Questions or tests that were not helpful and why]

IMPORTANT SECURITY RULES:
- Include "disease" in gameData for internal backend tracking ONLY
- Only set "revealedDisease" when game ends (correct guess or player gives up)
- Never mention the actual disease name in "message" unless game is over
- Keep the disease secret until the end!

Response types: "case_presentation", "symptom_update", "test_result", "hint", "correct_guess", "game_over"

WHEN TO USE EACH TYPE:
- "case_presentation": ONLY for initial case presentation
- "symptom_update": When player asks for more symptoms, symptom details, or follow-up questions about existing symptoms
- "test_result": When player requests specific tests or lab work
- "hint": When player makes incorrect diagnosis guess
- "correct_guess": When player guesses the correct diagnosis
- "game_over": When revealing answer or ending game

RESPOND ONLY WITH JSON. NO OTHER TEXT.

**MESSAGE FORMATTING RULE:**
All content in the "message" field MUST be formatted using Markdown syntax:
- Use **bold** for emphasis
- Use *italics* for subtle highlights
- Use • or - for lists
- For disease revelation, strictly follow the provided markdown template`;

// Helper function to extract JSON from response
function extractJsonFromResponse(text) {
  try {
    // Try to parse as-is first
    return JSON.parse(text);
  } catch (e) {
    // Try to find JSON in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error("Failed to parse extracted JSON:", e2);
      }
    }
    return null;
  }
}

const OUTPUT_MODE = process.env.OUTPUT_MODE || "simple_json"; // "simple_json", "json_schema", "function_calling"

function getChatConfig() {
  const baseConfig = {
    model: MODEL_NAME,
    history: [
      {
        role: "model",
        parts: [{ text: SIMPLE_JSON_PROMPT }],
      },
    ],
  };

  return baseConfig;
}

// Helper function to get message config based on mode
function getMessageConfig(message) {
  const baseConfig = {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 1000,
    candidateCount: 1,
    stopSequences: [],
  };
  return {
    message: message + "\n\nRemember: Respond ONLY with JSON, no other text.",
    config: baseConfig,
  };
}

// Helper function to filter gameData for frontend (remove sensitive info)
function filterGameDataForFrontend(gameData) {
  if (!gameData) return null;

  const { ...filteredData } = gameData;
  return filteredData;
}

// Variety Configuration - Adjust these values to control diversity
const VARIETY_CONFIG = {
  FORCE_DIFFERENT_SYSTEM: true, // Never repeat same body system consecutively
  FORCE_DIFFERENT_CATEGORY: true, // Never repeat same disease category consecutively
  MIN_AGE_DIFFERENCE: 15, // Minimum age difference between consecutive games
  MAX_SAME_GENDER_CONSECUTIVE: 2, // Max consecutive games with same gender
  DEMOGRAPHIC_VARIETY_LEVEL: "high", // "low", "medium", "high", "maximum"
  INCLUDE_RARE_CONDITIONS: true, // Include uncommon diseases
  INCLUDE_PEDIATRIC_CASES: true, // Include child-specific conditions
  INCLUDE_GERIATRIC_CASES: true, // Include elderly-specific conditions
  INCLUDE_EMERGENCY_CASES: true, // Include emergency/trauma cases
  CULTURAL_CONTEXT_FREQUENCY: 0.3, // 30% of cases include cultural context
  OCCUPATIONAL_CONTEXT_FREQUENCY: 0.7, // 70% of cases include occupation details
};

// Enhanced variety tracking (in production, store this in database)
const GAME_HISTORY = {
  recentBodySystems: [], // Track last 10 body systems used
  recentDiseaseCategories: [], // Track last 10 disease categories
  recentAges: [], // Track last 10 ages used
  recentGenders: [], // Track last 10 genders used
  gameCount: 0,
};

// Utility function to enforce variety in system selection
function selectVariedBodySystem() {
  const availableSystems = [
    "cardiovascular",
    "respiratory",
    "gastrointestinal",
    "neurological",
    "endocrine",
    "musculoskeletal",
    "infectious",
    "hematologic",
    "autoimmune",
    "psychiatric",
    "dermatologic",
    "genitourinary",
    "ophthalmologic",
    "otolaryngology",
    "gynecologic",
    "urologic",
    "oncologic",
    "allergic",
    "rheumatologic",
    "hepatobiliary",
    "nephrology",
    "vascular",
    "metabolic",
    "nutritional",
    "toxicologic",
    "traumatic",
    "congenital",
    "pediatric",
    "geriatric",
    "emergency",
    "critical_care",
    "pulmonary",
    "gastroenterology",
    "cardiothoracic",
    "neurosurgical",
    "orthopedic",
    "plastic_surgery",
    "anesthetic",
    "radiologic",
    "pathologic",
  ];

  if (
    VARIETY_CONFIG.FORCE_DIFFERENT_SYSTEM &&
    GAME_HISTORY.recentBodySystems.length > 0
  ) {
    const recentSystems = GAME_HISTORY.recentBodySystems.slice(-3); // Avoid last 3 systems
    const availableOptions = availableSystems.filter(
      (system) => !recentSystems.includes(system)
    );
    return availableOptions.length > 0 ? availableOptions : availableSystems;
  }

  return availableSystems;
}

// Utility function to generate varied demographics

// Function to track and enforce variety
function trackGameVariety(gameData) {
  GAME_HISTORY.gameCount++;

  // Track recent selections (keep last 10)
  GAME_HISTORY.recentBodySystems.push(gameData.bodySystem);
  if (GAME_HISTORY.recentBodySystems.length > 10) {
    GAME_HISTORY.recentBodySystems.shift();
  }

  GAME_HISTORY.recentAges.push(gameData.age);
  if (GAME_HISTORY.recentAges.length > 10) {
    GAME_HISTORY.recentAges.shift();
  }

  GAME_HISTORY.recentGenders.push(gameData.gender);
  if (GAME_HISTORY.recentGenders.length > 10) {
    GAME_HISTORY.recentGenders.shift();
  }
}

// Function to get variety statistics (for debugging/monitoring)
function computeVarietyStats() {
  return {
    totalGames: GAME_HISTORY.gameCount,
    uniqueSystemsUsed: new Set(GAME_HISTORY.recentBodySystems).size,
    uniqueAgesUsed: new Set(GAME_HISTORY.recentAges).size,
    uniqueGendersUsed: new Set(GAME_HISTORY.recentGenders).size,
    recentSystems: GAME_HISTORY.recentBodySystems.slice(-5),
    config: VARIETY_CONFIG,
  };
}

export const startGame = async (req, res, next) => {
  try {
    const chat = await ai.chats.create(getChatConfig());

    // Start timing the LLM response
    const startTime = Date.now();

    // Add variety to the initial message to encourage different presentations
    const initialMessages = [
      "Create a completely unique case from a different body system than usual. Vary age, gender, and symptoms dramatically.",
      "Generate a case from a different medical category with unique demographics. Avoid repetitive patterns.",
      "Start a fresh game with a different age group, gender, and completely different symptom profile.",
      "Create a diagnostic challenge from a new body system. Use unique age, varied symptoms, and different presentation style.",
      "Begin with a case that's completely different from typical presentations. Rotate body systems and demographics.",
      "Generate a unique medical mystery with different age, gender, and symptom combinations than usually seen.",
      "Create a case from a different disease category with varied demographics and unique symptom presentation.",
      "Start a completely different type of case. Vary the body system, age range, and symptom profile significantly.",
      "Generate a diagnostic puzzle with unique demographics and symptoms from a different medical category.",
      "Create a fresh case that breaks typical patterns. Use different age, gender, body system, and symptom combinations.",
      "Begin with a case from a different specialty area. Ensure completely different demographics and symptom profile.",
      "Generate a unique presentation with different age group, gender, and body system than commonly used.",
    ];

    // Add specific random selection instructions
    const randomSelectionPrompts = [
      "Pick a random age between 18-25, use cardiovascular system, make it a female patient",
      "Pick a random age between 45-60, use respiratory system, make it a male patient",
      "Pick a random age between 25-35, use gastrointestinal system, make it a female patient",
      "Pick a random age between 60-75, use neurological system, make it a male patient",
      "Pick a random age between 35-50, use endocrine system, make it a female patient",
      "Pick a random age between 20-30, use musculoskeletal system, make it a male patient",
      "Pick a random age between 50-65, use infectious disease, make it a female patient",
      "Pick a random age between 30-45, use hematologic system, make it a male patient",
      "Pick a random age between 65-80, use autoimmune condition, make it a female patient",
      "Pick a random age between 18-28, use psychiatric condition with somatic symptoms, make it a male patient",
    ];

    // Create completely random combinations to force variety
    const minAge = 18;
    const maxAge = 85;
    const genders = ["male", "female"];
    const bodySystems = [
      "cardiovascular",
      "respiratory",
      "gastrointestinal",
      "neurological",
      "endocrine",
      "musculoskeletal",
      "infectious",
      "hematologic",
      "autoimmune",
      "psychiatric",
      "dermatologic",
      "genitourinary",
      "ophthalmologic", // Eye-related conditions
      "otolaryngology", // ENT (Ear, Nose, Throat)
      "gynecologic", // Women's health
      "urologic", // Urinary system (more specific than genitourinary)
      "oncologic", // Cancer-related
      "allergic", // Allergy and immunology
      "rheumatologic", // Joint and connective tissue
      "hepatobiliary", // Liver and bile system
      "nephrology", // Kidney-specific
      "vascular", // Blood vessel diseases
      "metabolic", // Metabolic disorders
      "nutritional", // Nutrition-related
      "toxicologic", // Poisoning and toxicity
      "traumatic", // Injury-related
      "congenital", // Birth defects
      "pediatric", // Child-specific conditions
      "geriatric", // Elderly-specific conditions
      "emergency", // Emergency medicine conditions
      "critical_care", // ICU-type conditions
      "pulmonary", // More specific respiratory
      "gastroenterology", // More specific GI
      "cardiothoracic", // Heart and chest
      "neurosurgical", // Brain surgery conditions
      "orthopedic", // Bone and joint specific
      "plastic_surgery", // Reconstruction/cosmetic
      "anesthetic", // Anesthesia complications
      "radiologic", // Imaging-detected conditions
      "pathologic", // Laboratory/pathology findings
    ];

    const randomAge =
      Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
    const randomGender = genders[Math.floor(Math.random() * genders.length)];
    const randomBodySystem =
      bodySystems[Math.floor(Math.random() * bodySystems.length)];

    const forceRandomPrompt = `Create a unique case: ${randomAge}-year-old ${randomGender} with a ${randomBodySystem} condition.`;

    const useRandomSelection = Math.random() < 0.5; // 50% chance each method
    const useForceRandom = Math.random() < 0.8; // 80% chance to use forced randomization

    let randomMessage;
    if (useForceRandom) {
      randomMessage = forceRandomPrompt;
    } else if (useRandomSelection) {
      randomMessage =
        randomSelectionPrompts[
          Math.floor(Math.random() * randomSelectionPrompts.length)
        ];
    } else {
      randomMessage =
        initialMessages[Math.floor(Math.random() * initialMessages.length)];
    }

    const messageConfig = getMessageConfig(randomMessage);
    const firstResponse = await chat.sendMessage(messageConfig);

    // End timing
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Parse the structured response
    let structuredResponse = extractJsonFromResponse(firstResponse.text);

    if (!structuredResponse) {
      console.error(
        "Failed to extract JSON from response:",
        firstResponse.text
      );
      // Fallback to text response
      structuredResponse = {
        gameData: {
          age: null,
          gender: null,
          bodySystem: null,
          disease: null,
          symptoms: [],
        },
        response: {
          message: firstResponse.text,
          type: "case_presentation",
          finished: false,
          testResults: null,
          revealedDisease: {},
        },
      };
    }

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
      chat,
      startTime,
      gameData: structuredResponse.gameData,
    });

    // Track variety for future games
    if (structuredResponse.gameData) {
      trackGameVariety(structuredResponse.gameData);
    }

    const usageMetadata = firstResponse.usageMetadata;

    // Send filtered response to frontend (without disease)
    res.json({
      sessionId,
      reply: structuredResponse.message,
      gameData: filterGameDataForFrontend(structuredResponse.gameData),
      responseType: structuredResponse.response.type,
      finished: structuredResponse.response.finished,
      testResults: structuredResponse.response.testResults,
      responseTime: responseTime,
      endTime: endTime,
      startTime: startTime,
      responseTimeFormatted: `${responseTime}ms`,
      rawResponse: firstResponse.text, // For debugging
      outputMode: OUTPUT_MODE, // For debugging
      usageMetadata,
    });
  } catch (err) {
    next(err);
  }
};

export const continueGame = async (req, res, next) => {
  const { sessionId } = req.params;
  const { message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const sessionData = sessions.get(sessionId);
  if (!sessionData) {
    return res.status(404).json({ error: "Session not found or expired" });
  }

  const { chat, gameData } = sessionData;

  try {
    // Start timing the LLM response
    const startTime = Date.now();

    // Check if this might be a disease guess for additional validation
    const isLikelyGuess =
      message.length < 50 &&
      !message.includes("?") &&
      !message.toLowerCase().includes("test") &&
      !message.toLowerCase().includes("symptoms");

    let guessValidation = null;
    if (isLikelyGuess && gameData && gameData.disease) {
      guessValidation = {
        userGuess: message,
        actualDisease: gameData.disease,
        normalizedGuess: normalizeGuess(message),
        isCorrect: isGuessCorrect(message, gameData.disease),
        timestamp: Date.now(),
      };
    }

    const messageConfig = getMessageConfig(message);
    const response = await chat.sendMessage(messageConfig);

    // End timing
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Parse the structured response
    let structuredResponse = extractJsonFromResponse(response.text);

    if (!structuredResponse) {
      console.error("Failed to extract JSON from response:", response.text);
      // Fallback to text response with basic structure
      structuredResponse = {
        gameData: gameData,
        response: {
          message: response.text,
          type: "hint",
          finished: false,
          testResults: null,
          revealedDisease: {},
        },
      };
    }

    // Update game data with new information (keep disease in backend)
    Object.assign(gameData, structuredResponse.gameData);

    // Track variety for future games
    if (structuredResponse.gameData) {
      trackGameVariety(structuredResponse.gameData);
    }

    const finished =
      structuredResponse.response.finished ||
      structuredResponse.response.type === "correct_guess" ||
      structuredResponse.response.type === "game_over";

    if (finished) {
      sessions.delete(sessionId);
    }

    if (
      guessValidation &&
      structuredResponse.response.type === "correct_guess" &&
      !guessValidation.isCorrect
    ) {
      console.warn(
        "AI marked as correct but helper function says incorrect:",
        guessValidation
      );
    }
    if (
      guessValidation &&
      structuredResponse.response.type === "hint" &&
      guessValidation.isCorrect
    ) {
      console.warn(
        "AI marked as incorrect but helper function says correct:",
        guessValidation
      );
    }

    const usageMetadata = response.usageMetadata;

    // Send filtered response to frontend (without disease unless game is over)
    res.json({
      reply: structuredResponse.response.message,
      gameData: filterGameDataForFrontend(gameData), // Use accumulated gameData, not just the response
      responseType: structuredResponse.response.type,
      finished: finished,
      testResults: structuredResponse.response.testResults,
      responseTime: responseTime,
      revealedDisease: structuredResponse.response.revealedDisease,
      endTime: endTime,
      startTime: startTime,
      responseTimeFormatted: `${responseTime}ms`,
      rawResponse: response.text, // For debugging
      outputMode: OUTPUT_MODE, // For debugging
      guessValidation: guessValidation, // For debugging (only in development)
      usageMetadata,
    });
  } catch (err) {
    next(err);
  }
};

// Debug endpoint to test different output modes
export const testOutput = async (req, res, next) => {
  const { prompt, mode } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const testMode = mode || OUTPUT_MODE;

  try {
    const originalMode = process.env.OUTPUT_MODE;
    process.env.OUTPUT_MODE = testMode;

    const chat = await ai.chats.create(getChatConfig());
    const messageConfig = getMessageConfig(prompt);
    const response = await chat.sendMessage(messageConfig);

    process.env.OUTPUT_MODE = originalMode;
    const structuredResponse = extractJsonFromResponse(response.text);

    res.json({
      success: true,
      mode: testMode,
      rawResponse: response.text,
      structuredResponse: structuredResponse,
      parsed: !!structuredResponse,
    });
  } catch (err) {
    next(err);
  }
};

// Configuration endpoint
export const getConfig = async (req, res, next) => {
  try {
    res.json({
      outputMode: OUTPUT_MODE,
      availableModes: ["simple_json", "json_schema", "function_calling"],
      modelName: MODEL_NAME,
      activeSessions: sessions.size,
    });
  } catch (err) {
    next(err);
  }
};

// Debug endpoint to test disease matching
export const testMatching = async (req, res, next) => {
  const { guess, disease } = req.body;

  if (!guess || !disease) {
    return res
      .status(400)
      .json({ error: "Both guess and disease are required" });
  }

  try {
    const synonymMap = createDiseaseSynonymMap();
    const normalizedGuess = normalizeGuess(guess);
    const normalizedDisease = disease.toLowerCase().replace(/_/g, " ");

    const guessCanonical = synonymMap.get(normalizedGuess);
    const diseaseCanonical = synonymMap.get(normalizedDisease) || disease;

    const isCorrect = isGuessCorrect(guess, disease);

    // Get all synonyms for the disease
    const allSynonyms = [];
    for (const [synonym, canonical] of synonymMap.entries()) {
      if (canonical === diseaseCanonical) {
        allSynonyms.push(synonym);
      }
    }

    res.json({
      input: {
        guess,
        disease,
      },
      normalized: {
        guess: normalizedGuess,
        disease: normalizedDisease,
      },
      canonical: {
        guess: guessCanonical,
        disease: diseaseCanonical,
      },
      result: {
        isCorrect,
        reason: isCorrect ? "Match found" : "No match found",
      },
      availableSynonyms: allSynonyms,
      synonymMapSize: synonymMap.size,
    });
  } catch (err) {
    next(err);
  }
};

// Variety statistics endpoint
export const getVarietyStats = async (req, res, next) => {
  try {
    const stats = computeVarietyStats();

    res.json({
      success: true,
      statistics: stats,
      recommendations: {
        systemsToAvoid: GAME_HISTORY.recentBodySystems.slice(-3),
        suggestedSystems: selectVariedBodySystem().slice(0, 5),
        varietyScore: calculateVarietyScore(),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Calculate variety score (0-100)
function calculateVarietyScore() {
  if (GAME_HISTORY.gameCount === 0) return 100;

  const systemVariety =
    (new Set(GAME_HISTORY.recentBodySystems).size /
      Math.min(10, GAME_HISTORY.gameCount)) *
    30;
  const ageVariety =
    (new Set(GAME_HISTORY.recentAges).size /
      Math.min(10, GAME_HISTORY.gameCount)) *
    25;
  const genderVariety =
    (new Set(GAME_HISTORY.recentGenders).size /
      Math.min(2, GAME_HISTORY.gameCount)) *
    25;
  const recentSystemDiversity =
    GAME_HISTORY.recentBodySystems.length > 3
      ? (new Set(GAME_HISTORY.recentBodySystems.slice(-5)).size / 5) * 20
      : 20;

  return Math.min(
    100,
    Math.round(
      systemVariety + ageVariety + genderVariety + recentSystemDiversity
    )
  );
}

// Configuration update endpoint
export const updateVarietyConfig = async (req, res, next) => {
  try {
    const { config } = req.body;

    if (config) {
      Object.assign(VARIETY_CONFIG, config);
    }

    res.json({
      success: true,
      updatedConfig: VARIETY_CONFIG,
      message: "Variety configuration updated successfully",
    });
  } catch (err) {
    next(err);
  }
};
