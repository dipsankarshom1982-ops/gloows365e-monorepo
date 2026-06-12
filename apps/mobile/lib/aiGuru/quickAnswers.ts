export interface QuickAnswer {
  id:       string;
  question: string;
  answer:   string;
  subject:  string;
  emoji:    string;
  keywords: string[];
  classes:  number[];
}

export const QUICK_ANSWERS: QuickAnswer[] = [
  // ─── Math ────────────────────────────────────────────────────────────────────
  {
    id: "math-pythagoras",
    question: "What is Pythagoras theorem?",
    answer:
      "Pythagoras theorem states that in a right-angled triangle, the square of the hypotenuse (the side opposite the right angle) equals the sum of squares of the other two sides. Written as a² + b² = c², where c is the hypotenuse. For example, if a = 3 and b = 4, then c = 5 because 9 + 16 = 25.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["pythagoras", "theorem", "right", "triangle", "hypotenuse", "pythagorean"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "math-prime",
    question: "What is a prime number?",
    answer:
      "A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself. Examples of prime numbers are 2, 3, 5, 7, 11, 13. The number 2 is the only even prime number. A number like 6 is NOT prime because it can be divided by 1, 2, 3, and 6.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["prime", "number", "divisor", "factor"],
    classes: [5, 6, 7, 8],
  },
  {
    id: "math-hcf-lcm",
    question: "What is HCF and LCM?",
    answer:
      "HCF (Highest Common Factor) is the largest number that divides two or more numbers exactly. LCM (Lowest Common Multiple) is the smallest number that is a multiple of two or more numbers. For 12 and 18: HCF = 6 (highest factor of both) and LCM = 36 (smallest multiple of both). A useful formula: HCF × LCM = Product of the two numbers.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["hcf", "lcm", "highest", "common", "factor", "lowest", "multiple"],
    classes: [5, 6, 7, 8],
  },
  {
    id: "math-bodmas",
    question: "What is BODMAS rule?",
    answer:
      "BODMAS stands for Brackets, Orders (powers/roots), Division, Multiplication, Addition, and Subtraction. It tells you the order to perform operations in a math expression. First solve Brackets, then powers/roots, then divide/multiply (left to right), and finally add/subtract (left to right). Example: 2 + 3 × 4 = 2 + 12 = 14, NOT 20.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["bodmas", "order", "operations", "brackets", "division", "multiplication"],
    classes: [5, 6, 7],
  },
  {
    id: "math-quadratic",
    question: "What is the quadratic formula?",
    answer:
      "The quadratic formula solves any equation of the form ax² + bx + c = 0. The formula is x = (−b ± √(b²−4ac)) / 2a. The part b²−4ac is called the discriminant. If it is positive, there are 2 real roots; if zero, one root; if negative, no real roots. This formula works when you cannot factorize the equation easily.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["quadratic", "formula", "equation", "roots", "discriminant"],
    classes: [9, 10, 11],
  },
  {
    id: "math-angles",
    question: "What are the types of angles?",
    answer:
      "Angles are classified by their measure: Acute angle (less than 90°), Right angle (exactly 90°), Obtuse angle (between 90° and 180°), Straight angle (exactly 180°), Reflex angle (between 180° and 360°), and Complete angle (exactly 360°). The sum of angles in any triangle is always 180°.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["angle", "acute", "obtuse", "right", "reflex", "types"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "math-mean-median-mode",
    question: "What is mean, median and mode?",
    answer:
      "Mean is the average — add all values and divide by the count. Median is the middle value when data is arranged in order. Mode is the value that appears most often. For data 2, 3, 3, 4, 8: Mean = 20÷5 = 4, Median = 3 (middle value), Mode = 3 (appears twice). These are called measures of central tendency.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["mean", "median", "mode", "average", "statistics", "central tendency"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "math-simple-interest",
    question: "What is simple interest?",
    answer:
      "Simple interest is calculated only on the original principal amount. Formula: SI = (P × R × T) / 100, where P = Principal (initial amount), R = Rate of interest per year, T = Time in years. Example: ₹1000 at 5% for 3 years gives SI = (1000×5×3)/100 = ₹150. Total amount = P + SI = ₹1150.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["simple", "interest", "principal", "rate", "time", "si"],
    classes: [7, 8, 9],
  },
  {
    id: "math-compound-interest",
    question: "What is compound interest?",
    answer:
      "Compound interest is interest calculated on both the principal and the accumulated interest. Formula: A = P(1 + R/100)^T, where A = Final amount, P = Principal, R = Rate per year, T = Time in years. CI = A − P. Unlike simple interest, compound interest grows faster because interest is added to the principal each period.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["compound", "interest", "principal", "ci", "amount"],
    classes: [8, 9, 10],
  },
  {
    id: "math-profit-loss",
    question: "What is profit and loss?",
    answer:
      "Profit = Selling Price (SP) − Cost Price (CP), when SP > CP. Loss = CP − SP, when CP > SP. Profit % = (Profit ÷ CP) × 100. Loss % = (Loss ÷ CP) × 100. SP for desired profit% = CP × (100 + Profit%) / 100. These concepts are used in business and everyday buying and selling.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["profit", "loss", "selling", "cost", "price", "percentage"],
    classes: [7, 8, 9],
  },
  {
    id: "math-trigonometry",
    question: "What are sin, cos and tan in trigonometry?",
    answer:
      "In a right-angled triangle: sin θ = Opposite / Hypotenuse, cos θ = Adjacent / Hypotenuse, tan θ = Opposite / Adjacent. A common memory trick is SOH-CAH-TOA. Key values: sin 30° = 0.5, sin 60° = √3/2, sin 90° = 1. These ratios are used to find unknown angles or sides in triangles.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["sin", "cos", "tan", "trigonometry", "sine", "cosine", "tangent", "soh", "cah", "toa"],
    classes: [10, 11, 12],
  },
  {
    id: "math-probability",
    question: "What is probability?",
    answer:
      "Probability measures how likely an event is to happen. Formula: P(event) = (Number of favourable outcomes) / (Total number of outcomes). Probability is always between 0 and 1. P = 0 means impossible, P = 1 means certain. Example: Probability of getting heads in a coin toss = 1/2 = 0.5.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["probability", "chance", "likely", "outcome", "event"],
    classes: [9, 10, 11],
  },
  {
    id: "math-sets",
    question: "What is a set in mathematics?",
    answer:
      "A set is a well-defined collection of distinct objects called elements. Sets are written using curly brackets, e.g., A = {1, 2, 3}. Types include: Finite set (limited elements), Infinite set (unlimited), Empty set (no elements, written {}), Universal set (all elements under consideration), and Subset (all elements of one set are in another). Union (A∪B) combines both sets; Intersection (A∩B) gives common elements.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["set", "union", "intersection", "subset", "element", "finite", "infinite"],
    classes: [11, 12],
  },
  {
    id: "math-coordinate-geometry",
    question: "What is coordinate geometry?",
    answer:
      "Coordinate geometry uses a number line system (x-axis and y-axis) to represent points, lines, and shapes. A point is written as (x, y). The origin is (0, 0). The distance between two points (x₁,y₁) and (x₂,y₂) = √[(x₂−x₁)² + (y₂−y₁)²]. The midpoint formula = ((x₁+x₂)/2, (y₁+y₂)/2). Slope of a line = (y₂−y₁)/(x₂−x₁).",
    subject: "Math",
    emoji: "🔢",
    keywords: ["coordinate", "geometry", "axis", "point", "distance", "midpoint", "slope"],
    classes: [9, 10, 11],
  },
  {
    id: "math-integers",
    question: "What are integers?",
    answer:
      "Integers are whole numbers that include positive numbers, negative numbers, and zero. Examples: ..., −3, −2, −1, 0, 1, 2, 3, ... Positive integers are 1, 2, 3... and negative integers are −1, −2, −3... Rules: positive × positive = positive, negative × negative = positive, positive × negative = negative. Zero is neither positive nor negative.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["integer", "positive", "negative", "whole", "number"],
    classes: [6, 7],
  },
  {
    id: "math-exponents",
    question: "What are exponents and powers?",
    answer:
      "An exponent tells how many times a number (the base) is multiplied by itself. For example, 2³ = 2 × 2 × 2 = 8. Key laws: aᵐ × aⁿ = aᵐ⁺ⁿ, aᵐ ÷ aⁿ = aᵐ⁻ⁿ, (aᵐ)ⁿ = aᵐⁿ, a⁰ = 1 (any number to power 0 is 1), a⁻ⁿ = 1/aⁿ. These rules are essential for simplifying expressions.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["exponent", "power", "base", "laws", "indices"],
    classes: [7, 8, 9],
  },
  {
    id: "math-fractions",
    question: "What are fractions and how to add them?",
    answer:
      "A fraction represents a part of a whole, written as numerator/denominator (e.g., 3/4 means 3 parts out of 4). To add fractions with the same denominator, just add numerators: 1/4 + 2/4 = 3/4. For different denominators, find the LCM first: 1/3 + 1/4 → LCM = 12 → 4/12 + 3/12 = 7/12. To multiply fractions: multiply numerators together and denominators together.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["fraction", "numerator", "denominator", "add", "multiply", "lcm"],
    classes: [5, 6, 7],
  },
  {
    id: "math-percentage",
    question: "What is percentage?",
    answer:
      "Percentage means 'per hundred'. To convert a fraction to percentage, multiply by 100. Example: 3/4 = 75%. To find percentage of a number: (percentage ÷ 100) × number. Example: 20% of 500 = (20/100) × 500 = 100. To find what percentage one number is of another: (part ÷ whole) × 100. Percentages are used in marks, discounts, tax, and interest.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["percentage", "percent", "per", "hundred", "fraction", "convert"],
    classes: [6, 7, 8],
  },
  {
    id: "math-algebraic-expressions",
    question: "What are algebraic expressions?",
    answer:
      "An algebraic expression uses numbers, variables (like x, y), and operations (+, −, ×, ÷). Example: 3x + 2y − 5 is an algebraic expression. Terms are the parts separated by + or −. A monomial has one term (3x), binomial has two terms (x+2), trinomial has three terms. Like terms have the same variable and power and can be combined: 3x + 5x = 8x.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["algebraic", "expression", "variable", "term", "monomial", "binomial"],
    classes: [7, 8, 9],
  },
  {
    id: "math-area-perimeter",
    question: "What are area and perimeter formulas?",
    answer:
      "Perimeter is the total boundary length; Area is the space inside. Rectangle: Perimeter = 2(l+b), Area = l×b. Square: Perimeter = 4a, Area = a². Triangle: Area = ½ × base × height. Circle: Perimeter (circumference) = 2πr, Area = πr². Where π ≈ 3.14 and r = radius. These formulas help calculate fencing, flooring, painting, and more.",
    subject: "Math",
    emoji: "🔢",
    keywords: ["area", "perimeter", "rectangle", "square", "triangle", "circle", "formula"],
    classes: [6, 7, 8, 9],
  },

  // ─── Physics / Science ───────────────────────────────────────────────────────
  {
    id: "physics-newton-first",
    question: "What is Newton's first law of motion?",
    answer:
      "Newton's first law states that an object at rest stays at rest, and an object in motion stays in motion with the same speed and direction, unless acted upon by an unbalanced external force. This is also called the Law of Inertia. Inertia is the tendency of objects to resist changes in their state of motion. A book on a table stays still because all forces are balanced.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["newton", "first", "law", "inertia", "motion", "rest"],
    classes: [9, 10, 11],
  },
  {
    id: "physics-newton-second",
    question: "What is Newton's second law of motion?",
    answer:
      "Newton's second law states that Force = Mass × Acceleration (F = ma). The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass. Unit of force is Newton (N). Example: A 5 kg object accelerating at 3 m/s² needs F = 5 × 3 = 15 N of force. Greater force means greater acceleration for the same mass.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["newton", "second", "law", "force", "mass", "acceleration", "fma"],
    classes: [9, 10, 11],
  },
  {
    id: "physics-newton-third",
    question: "What is Newton's third law of motion?",
    answer:
      "Newton's third law states that for every action, there is an equal and opposite reaction. Forces always occur in pairs — the action and reaction forces are equal in magnitude but opposite in direction and act on different objects. Examples: When you push a wall, the wall pushes back; a rocket moves forward because gas is expelled backward; a gun recoils when a bullet is fired.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["newton", "third", "law", "action", "reaction", "equal", "opposite"],
    classes: [9, 10, 11],
  },
  {
    id: "physics-ohms-law",
    question: "What is Ohm's law?",
    answer:
      "Ohm's law states that the current through a conductor is directly proportional to the voltage across it, provided temperature remains constant. Formula: V = IR, where V = Voltage (Volts), I = Current (Amperes), R = Resistance (Ohms). Example: If V = 12V and R = 4Ω, then I = V/R = 12/4 = 3A. This law helps calculate values in electrical circuits.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["ohm", "law", "current", "voltage", "resistance", "circuit", "volt", "ampere"],
    classes: [10, 11, 12],
  },
  {
    id: "physics-speed-velocity",
    question: "What is the difference between speed and velocity?",
    answer:
      "Speed is the distance travelled per unit time and has no direction (scalar quantity). Velocity is the displacement per unit time and has both magnitude and direction (vector quantity). Speed = Distance / Time; Velocity = Displacement / Time. A car going around a circular track at 60 km/h has constant speed but changing velocity because direction keeps changing.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["speed", "velocity", "difference", "distance", "displacement", "scalar", "vector"],
    classes: [9, 10, 11],
  },
  {
    id: "physics-refraction",
    question: "What is refraction of light?",
    answer:
      "Refraction is the bending of light when it passes from one medium to another (e.g., air to water). Light bends toward the normal when entering a denser medium and away from the normal in a rarer medium. This is why a pencil looks bent in a glass of water. Snell's law: n₁ sin θ₁ = n₂ sin θ₂. The refractive index tells how much light slows down in that medium.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["refraction", "light", "bending", "medium", "snell", "refractive index"],
    classes: [10, 11, 12],
  },
  {
    id: "physics-reflection",
    question: "What is reflection of light?",
    answer:
      "Reflection is the bouncing back of light when it hits a surface. The two laws of reflection are: (1) The angle of incidence equals the angle of reflection. (2) The incident ray, reflected ray, and normal all lie in the same plane. Regular reflection (on smooth mirror) gives a clear image; diffuse reflection (on rough surface) scatters light in all directions.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["reflection", "light", "mirror", "angle", "incidence", "law"],
    classes: [8, 9, 10],
  },
  {
    id: "physics-work-energy",
    question: "What is work and energy in physics?",
    answer:
      "Work is done when a force causes an object to move. Formula: W = F × d × cos θ, where F = force, d = displacement, θ = angle between force and displacement. Unit is Joule (J). Energy is the capacity to do work. Kinetic energy (energy of motion) = ½mv². Potential energy (stored energy due to position) = mgh. Energy is conserved — it changes form but never destroyed.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["work", "energy", "kinetic", "potential", "joule", "force", "power"],
    classes: [9, 10, 11],
  },
  {
    id: "physics-friction",
    question: "What is friction?",
    answer:
      "Friction is the force that opposes the relative motion between two surfaces in contact. It acts opposite to the direction of motion. Types: Static friction (prevents stationary objects from moving), Kinetic/Sliding friction (acts on moving objects), Rolling friction (when an object rolls). Friction depends on surface roughness and the normal force. It is useful for walking and braking but wastes energy in machines.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["friction", "static", "kinetic", "rolling", "surface", "oppose", "motion"],
    classes: [8, 9, 10],
  },
  {
    id: "physics-magnetic-field",
    question: "What is a magnetic field?",
    answer:
      "A magnetic field is the region around a magnet where its force is felt. Magnetic field lines flow from the North pole to the South pole outside the magnet. Moving electric charges (current) create magnetic fields — this is the basis of electromagnets. Earth itself has a magnetic field, which makes compass needles point north. SI unit of magnetic field strength is Tesla (T).",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["magnetic", "field", "magnet", "pole", "north", "south", "current", "electromagnet"],
    classes: [10, 11, 12],
  },
  {
    id: "physics-circuit-current",
    question: "What is electric current and circuit?",
    answer:
      "Electric current is the flow of electric charges (electrons) through a conductor. Unit is Ampere (A). An electric circuit is a closed path through which current flows. It has a source (battery), conductors (wires), and components (bulbs, resistors). Series circuit: components in one line — current same, voltage divides. Parallel circuit: components in separate branches — voltage same, current divides.",
    subject: "Physics",
    emoji: "⚡",
    keywords: ["current", "circuit", "series", "parallel", "electric", "electron", "conductor"],
    classes: [10, 11, 12],
  },

  // ─── Science (General) ───────────────────────────────────────────────────────
  {
    id: "science-photosynthesis",
    question: "What is photosynthesis?",
    answer:
      "Photosynthesis is the process by which green plants make their own food using sunlight. The equation is: 6CO₂ + 6H₂O + Light energy → C₆H₁₂O₆ (glucose) + 6O₂. It takes place in chloroplasts, which contain chlorophyll (the green pigment). Plants absorb carbon dioxide from air and water from the soil, and release oxygen as a by-product. This is why plants are called producers.",
    subject: "Science",
    emoji: "🔬",
    keywords: ["photosynthesis", "plant", "food", "chlorophyll", "sunlight", "carbon dioxide", "oxygen"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "science-respiration",
    question: "What is respiration?",
    answer:
      "Respiration is the process of breaking down food (glucose) to release energy in cells. Aerobic respiration (with oxygen): C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + Energy (ATP). Anaerobic respiration (without oxygen) produces lactic acid (in muscles during exercise) or alcohol (in yeast). Every living cell performs respiration 24/7 to get energy for all life processes.",
    subject: "Science",
    emoji: "🔬",
    keywords: ["respiration", "aerobic", "anaerobic", "energy", "glucose", "oxygen", "atp"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "science-food-chain",
    question: "What is a food chain?",
    answer:
      "A food chain shows how energy flows from one organism to another through feeding. It starts with producers (plants), which are eaten by primary consumers (herbivores), then secondary consumers (carnivores), then tertiary consumers. Example: Grass → Grasshopper → Frog → Snake → Eagle. Each level is called a trophic level. About 10% of energy is transferred to the next level — the rest is lost as heat.",
    subject: "Science",
    emoji: "🔬",
    keywords: ["food", "chain", "producer", "consumer", "herbivore", "carnivore", "energy", "trophic"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "science-water-cycle",
    question: "What is the water cycle?",
    answer:
      "The water cycle is the continuous movement of water through Earth's systems. Steps: Evaporation (water from oceans/lakes turns to vapour due to sun's heat), Condensation (vapour cools and forms clouds), Precipitation (water falls as rain, snow, or hail), Collection (water collects in oceans, rivers, groundwater), and then evaporates again. It purifies water and distributes it across Earth.",
    subject: "Science",
    emoji: "🔬",
    keywords: ["water", "cycle", "evaporation", "condensation", "precipitation", "rain"],
    classes: [6, 7, 8],
  },
  {
    id: "science-layers-earth",
    question: "What are the layers of the Earth?",
    answer:
      "Earth has four main layers. The Crust is the outermost thin layer (5-70 km thick) where we live. The Mantle is the thickest layer (about 2900 km) made of semi-molten rock called magma. The Outer Core is liquid iron and nickel, responsible for Earth's magnetic field. The Inner Core is solid iron and nickel, extremely hot (~5000°C). Plate tectonics cause earthquakes and volcanoes.",
    subject: "Science",
    emoji: "🔬",
    keywords: ["earth", "layers", "crust", "mantle", "core", "inner", "outer"],
    classes: [7, 8, 9],
  },

  // ─── Chemistry ───────────────────────────────────────────────────────────────
  {
    id: "chem-atom-molecule",
    question: "What is the difference between atom and molecule?",
    answer:
      "An atom is the smallest unit of an element that retains the properties of that element. It has protons, neutrons, and electrons. A molecule is formed when two or more atoms bond together. Example: H₂O (water) is a molecule made of 2 hydrogen atoms and 1 oxygen atom. O₂ (oxygen gas) is a molecule of 2 oxygen atoms. All matter is made of atoms, but most substances exist as molecules.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["atom", "molecule", "difference", "element", "bond", "proton", "electron"],
    classes: [8, 9, 10],
  },
  {
    id: "chem-acids-bases",
    question: "What are acids and bases?",
    answer:
      "Acids are substances that release H⁺ ions in water. They have a pH less than 7, taste sour, and turn blue litmus red. Examples: HCl (hydrochloric acid), H₂SO₄ (sulphuric acid), vinegar. Bases release OH⁻ ions, have pH greater than 7, feel slippery, and turn red litmus blue. Examples: NaOH, Mg(OH)₂. A neutral substance (like water) has pH = 7. When acid and base react, they form salt and water (neutralisation).",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["acid", "base", "ph", "neutral", "litmus", "neutralization", "hydrogen"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "chem-ph-scale",
    question: "What is the pH scale?",
    answer:
      "The pH scale measures how acidic or basic a substance is, ranging from 0 to 14. pH 0-6 = Acidic (lower = more acidic), pH 7 = Neutral, pH 8-14 = Basic/Alkaline (higher = more basic). Examples: Battery acid pH~1, lemon juice pH~2, pure water pH 7, baking soda pH~9, soap pH~10. The pH scale is logarithmic — each step is 10 times more acidic or basic than the next.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["ph", "scale", "acidic", "basic", "neutral", "alkaline"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "chem-periodic-table",
    question: "What is the periodic table?",
    answer:
      "The periodic table is an arrangement of all 118 known elements in order of increasing atomic number. Elements with similar properties are placed in the same vertical column (group). Horizontal rows are called periods. Metals are on the left, non-metals on the right, and metalloids in between. Created by Dmitri Mendeleev in 1869, it predicts element properties and relationships. Modern periodic law: properties of elements are periodic functions of their atomic numbers.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["periodic", "table", "element", "group", "period", "mendeleev", "atomic", "number"],
    classes: [9, 10, 11],
  },
  {
    id: "chem-valency",
    question: "What is valency?",
    answer:
      "Valency is the combining capacity of an element — how many bonds an atom can form with other atoms. It is determined by the number of electrons in the outermost shell (valence electrons). An atom is stable when its outermost shell is full (usually 8 electrons — octet rule). Example: Oxygen has 6 valence electrons, needs 2 more → valency = 2. Carbon has 4 valence electrons → valency = 4.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["valency", "valence", "electron", "combining", "capacity", "octet", "shell"],
    classes: [9, 10, 11],
  },
  {
    id: "chem-chemical-reaction",
    question: "What is a chemical reaction?",
    answer:
      "A chemical reaction is a process where substances (reactants) are transformed into new substances (products) with different properties. Types include: Combination (A+B→AB), Decomposition (AB→A+B), Displacement (A+BC→AC+B), and Double Displacement (AB+CD→AD+CB). Signs of a reaction include: colour change, gas produced, precipitate formed, temperature change. The law of conservation of mass states that mass is neither created nor destroyed in a reaction.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["chemical", "reaction", "reactant", "product", "combination", "decomposition", "displacement"],
    classes: [9, 10, 11],
  },
  {
    id: "chem-mixture-compound",
    question: "What is the difference between mixture and compound?",
    answer:
      "A mixture is a combination of two or more substances that are NOT chemically combined. Components retain their properties and can be separated by physical methods (filtering, evaporation). Examples: air, salt water, sand and iron filings. A compound is formed when elements combine chemically in fixed ratios, losing their individual properties. Example: Water (H₂O) is a compound of H and O. Compounds can only be separated by chemical methods.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["mixture", "compound", "difference", "separate", "element", "combined"],
    classes: [8, 9, 10],
  },
  {
    id: "chem-oxidation-reduction",
    question: "What is oxidation and reduction?",
    answer:
      "Oxidation is the loss of electrons (or gain of oxygen/loss of hydrogen). Reduction is the gain of electrons (or loss of oxygen/gain of hydrogen). They always occur together — called a redox reaction. Memory trick: OIL RIG — Oxidation Is Loss, Reduction Is Gain (of electrons). Example: In 2Mg + O₂ → 2MgO, magnesium is oxidised (gains oxygen) and oxygen is reduced.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["oxidation", "reduction", "redox", "electron", "oil", "rig", "gain", "loss"],
    classes: [10, 11, 12],
  },
  {
    id: "chem-corrosion",
    question: "What is corrosion?",
    answer:
      "Corrosion is the gradual destruction of metals due to their reaction with the environment (air, moisture, chemicals). The most common example is rusting of iron: 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃ → Fe₂O₃ (rust). Prevention methods: painting, oiling, galvanisation (zinc coating), alloying (stainless steel), electroplating, and using anti-rust coatings. Corrosion causes huge economic loss worldwide.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["corrosion", "rust", "iron", "oxidation", "prevention", "galvanisation"],
    classes: [10, 11],
  },
  {
    id: "chem-types-of-bonds",
    question: "What are types of chemical bonds?",
    answer:
      "Chemical bonds hold atoms together. Ionic bond: formed by transfer of electrons between a metal and non-metal (e.g., NaCl). Covalent bond: formed by sharing of electrons between two non-metals (e.g., H₂O, CO₂). Metallic bond: electrons are shared freely among metal atoms, making metals good conductors. Ionic compounds are usually solids with high melting points; covalent compounds can be gases, liquids, or solids.",
    subject: "Chemistry",
    emoji: "⚗️",
    keywords: ["bond", "ionic", "covalent", "metallic", "electron", "sharing", "transfer"],
    classes: [10, 11, 12],
  },

  // ─── Biology ─────────────────────────────────────────────────────────────────
  {
    id: "bio-cell-structure",
    question: "What is cell structure?",
    answer:
      "The cell is the basic unit of life. Key parts: Cell membrane (controls what enters/exits), Cytoplasm (jelly-like fluid where organelles are), Nucleus (control centre, contains DNA), Mitochondria (energy production — powerhouse of the cell), Ribosomes (protein synthesis), Endoplasmic Reticulum (transport system), Golgi Apparatus (packages and ships proteins). Plant cells also have cell wall and chloroplasts.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["cell", "structure", "nucleus", "mitochondria", "membrane", "cytoplasm", "organelle"],
    classes: [8, 9, 10, 11],
  },
  {
    id: "bio-plant-animal-cell",
    question: "What is the difference between plant and animal cell?",
    answer:
      "Both are eukaryotic cells with nucleus, cell membrane, cytoplasm, and mitochondria. Plant cells additionally have: Cell wall (rigid, made of cellulose for shape), Chloroplasts (for photosynthesis, containing chlorophyll), Large central vacuole (stores water and maintains cell pressure). Animal cells have: Centrioles (help in cell division), No cell wall, Small vacuoles. Animal cells are irregular in shape; plant cells are rectangular.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["plant", "animal", "cell", "difference", "cell wall", "chloroplast", "vacuole"],
    classes: [8, 9, 10],
  },
  {
    id: "bio-dna",
    question: "What is DNA?",
    answer:
      "DNA (Deoxyribonucleic Acid) is the molecule that carries genetic information in all living organisms. It has a double helix structure (like a twisted ladder) discovered by Watson and Crick in 1953. DNA is made of nucleotides, each containing a sugar, phosphate group, and one of four bases: Adenine (A), Thymine (T), Guanine (G), Cytosine (C). A always pairs with T, and G always pairs with C. Genes are segments of DNA that code for specific proteins.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["dna", "genetic", "gene", "double helix", "nucleotide", "adenine", "thymine", "chromosome"],
    classes: [10, 11, 12],
  },
  {
    id: "bio-digestive-system",
    question: "What is the human digestive system?",
    answer:
      "The digestive system breaks down food into nutrients the body can absorb. Path of food: Mouth (chewing + salivary amylase breaks starch) → Oesophagus (carries food to stomach) → Stomach (HCl and pepsin digest proteins) → Small intestine (main absorption — bile from liver and pancreatic juice complete digestion) → Large intestine (absorbs water) → Rectum → Anus (waste expelled). The entire process takes 24-72 hours.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["digestive", "system", "stomach", "intestine", "digestion", "absorption", "food"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "bio-circulatory-system",
    question: "What is the circulatory system?",
    answer:
      "The circulatory system transports blood, nutrients, oxygen, and waste throughout the body. The heart is the pump — it has 4 chambers (right atrium, right ventricle, left atrium, left ventricle). Arteries carry oxygenated blood away from heart; veins carry deoxygenated blood back to heart. Capillaries are tiny vessels where gas and nutrient exchange happens. Blood contains RBCs (carry oxygen), WBCs (fight infection), platelets (clotting), and plasma.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["circulatory", "system", "heart", "blood", "artery", "vein", "rbc", "wbc"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "bio-excretory-system",
    question: "What is the excretory system?",
    answer:
      "The excretory system removes metabolic waste products from the body. Main organ: Kidneys — they filter blood, remove urea (from protein breakdown) and other waste, producing urine. Each kidney contains millions of nephrons (functional units). Urine flows through ureters to the bladder, then expelled through the urethra. Skin removes salts and water through sweat. Lungs remove CO₂. Liver processes toxic substances.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["excretory", "system", "kidney", "urine", "nephron", "waste", "urea"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "bio-heredity",
    question: "What is heredity?",
    answer:
      "Heredity is the passing of traits from parents to offspring through genes. Gregor Mendel is the Father of Genetics. He discovered: Law of Dominance (dominant traits mask recessive ones), Law of Segregation (alleles separate during gamete formation). Dominant alleles (e.g., B for brown eyes) are expressed when present; recessive alleles (b for blue eyes) are expressed only when both copies are recessive (bb). DNA carries these genetic instructions in chromosomes.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["heredity", "genetics", "mendel", "dominant", "recessive", "gene", "trait", "inheritance"],
    classes: [10, 11, 12],
  },
  {
    id: "bio-ecosystem",
    question: "What is an ecosystem?",
    answer:
      "An ecosystem is a community of living organisms (biotic factors) interacting with their non-living environment (abiotic factors like water, sunlight, temperature, soil). Types: Forest, grassland, desert, aquatic (freshwater/marine). Energy flows through food chains from producers (plants) → consumers → decomposers. Decomposers (fungi, bacteria) break down dead matter and recycle nutrients. A balanced ecosystem maintains biodiversity and is self-sustaining.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["ecosystem", "biotic", "abiotic", "food", "chain", "biodiversity", "habitat", "environment"],
    classes: [8, 9, 10],
  },
  {
    id: "bio-vaccine",
    question: "What is a vaccine?",
    answer:
      "A vaccine is a biological preparation that provides immunity to a specific disease without causing the disease itself. It contains weakened or killed pathogens, or their proteins, that train the immune system to recognize and fight real infections. When vaccinated, the body produces antibodies and memory cells. Famous vaccines: Polio (Salk), Smallpox (Jenner), COVID-19 (mRNA vaccines). Vaccines have eradicated or controlled many deadly diseases worldwide.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["vaccine", "immunity", "antibody", "pathogen", "disease", "immunisation"],
    classes: [8, 9, 10, 11],
  },
  {
    id: "bio-nutrition",
    question: "What are types of nutrition?",
    answer:
      "Nutrition is how organisms obtain food and energy. Autotrophic nutrition: organisms make their own food. Photosynthesis (plants use sunlight) and Chemosynthesis (some bacteria use chemicals). Heterotrophic nutrition: organisms eat other organisms. Types: Holozoic (ingesting solid food — humans), Saprophytic (absorbing from dead matter — fungi, bacteria), Parasitic (living off a host — tapeworm). Nutrients include carbohydrates (energy), proteins (growth), fats (insulation), vitamins, minerals, and water.",
    subject: "Biology",
    emoji: "🧬",
    keywords: ["nutrition", "autotrophic", "heterotrophic", "holozoic", "saprophytic", "parasitic", "nutrient"],
    classes: [7, 8, 9, 10],
  },

  // ─── English ─────────────────────────────────────────────────────────────────
  {
    id: "eng-parts-of-speech",
    question: "What are the parts of speech?",
    answer:
      "The 8 parts of speech are: Noun (name of a person, place, or thing — 'dog', 'India'), Pronoun (replaces a noun — 'he', 'she', 'they'), Verb (action or state — 'run', 'is'), Adjective (describes a noun — 'big', 'red'), Adverb (modifies verb/adjective — 'quickly', 'very'), Preposition (shows relationship — 'in', 'on', 'at'), Conjunction (joins words/clauses — 'and', 'but'), Interjection (expresses emotion — 'Wow!', 'Oh!').",
    subject: "English",
    emoji: "📖",
    keywords: ["parts", "speech", "noun", "verb", "adjective", "adverb", "pronoun", "conjunction", "preposition"],
    classes: [5, 6, 7, 8],
  },
  {
    id: "eng-active-passive",
    question: "What is active and passive voice?",
    answer:
      "In active voice, the subject performs the action: 'Ram ate the apple.' In passive voice, the subject receives the action: 'The apple was eaten by Ram.' To convert: Object of active → Subject of passive, Active verb → be + past participle, Subject of active → by + agent. Tense changes: Simple present → am/is/are + V3, Simple past → was/were + V3, Future → will be + V3. Passive voice is used when the doer is unknown or unimportant.",
    subject: "English",
    emoji: "📖",
    keywords: ["active", "passive", "voice", "convert", "subject", "object", "verb"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "eng-tenses",
    question: "What are the tenses in English?",
    answer:
      "Tenses show when an action happens. Three main tenses: Present (happening now — 'I eat'), Past (happened before — 'I ate'), Future (will happen — 'I will eat'). Each has four aspects: Simple (basic fact), Continuous (ongoing action), Perfect (completed action), Perfect Continuous (ongoing action with duration). Key: Simple Present uses base verb + s/es for he/she/it. Simple Past uses V2 (ate, went). Future uses will/shall + base verb.",
    subject: "English",
    emoji: "📖",
    keywords: ["tense", "present", "past", "future", "simple", "continuous", "perfect"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "eng-simile-metaphor",
    question: "What is simile and metaphor?",
    answer:
      "A simile compares two things using 'like' or 'as': 'He is as brave as a lion.' A metaphor directly states one thing is another without using like/as: 'He is a lion in battle.' Both are figures of speech used to create vivid descriptions. Other figures of speech: Personification (giving human qualities to non-human things — 'The wind whispered'), Hyperbole (exaggeration — 'I've told you a million times'), Alliteration (same starting sound — 'Peter Piper picked peppers').",
    subject: "English",
    emoji: "📖",
    keywords: ["simile", "metaphor", "figure", "speech", "comparison", "like", "as"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "eng-direct-indirect",
    question: "What is direct and indirect speech?",
    answer:
      "Direct speech quotes the exact words spoken: Ram said, 'I am happy.' Indirect (reported) speech reports what was said without quotes, with tense changes: Ram said (that) he was happy. Tense changes: Present → Past (am → was), Past → Past Perfect (was → had been), Future → Conditional (will → would). Other changes: Pronouns and time expressions also change (now → then, today → that day, tomorrow → the next day).",
    subject: "English",
    emoji: "📖",
    keywords: ["direct", "indirect", "speech", "reported", "tense", "change", "quote"],
    classes: [8, 9, 10],
  },
  {
    id: "eng-sentence-types",
    question: "What are types of sentences?",
    answer:
      "Sentences are classified by purpose: Declarative (makes a statement — 'I like maths.'), Interrogative (asks a question — 'Do you like maths?'), Imperative (gives a command — 'Open the book.'), Exclamatory (expresses strong emotion — 'What a beautiful day!'). By structure: Simple (one independent clause), Compound (two independent clauses joined by a conjunction), Complex (one independent + one dependent clause), Compound-Complex (mix of both).",
    subject: "English",
    emoji: "📖",
    keywords: ["sentence", "type", "declarative", "interrogative", "imperative", "exclamatory", "simple", "compound", "complex"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "eng-subject-verb",
    question: "What is subject-verb agreement?",
    answer:
      "Subject-verb agreement means the verb must match the subject in number. Singular subject takes singular verb (adds -s/-es): 'She runs fast.' Plural subject takes plural verb (base form): 'They run fast.' Tricky rules: Collective nouns (team, group) take singular verb ('The team wins.'). Two subjects joined by 'and' take plural verb. With 'or'/'nor', the verb agrees with the nearer subject: 'Neither he nor they are ready.'",
    subject: "English",
    emoji: "📖",
    keywords: ["subject", "verb", "agreement", "singular", "plural", "match", "grammar"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "eng-punctuation",
    question: "What are punctuation rules?",
    answer:
      "Key punctuation rules: Full stop (.) ends a sentence. Comma (,) separates items in a list, clauses, or introduces a quotation. Question mark (?) ends a question. Exclamation mark (!) ends an exclamatory sentence. Apostrophe (') shows possession (Ram's book) or contraction (don't = do not). Colon (:) introduces a list. Semicolon (;) joins two related independent clauses. Inverted commas (''/\"\") mark direct speech or titles.",
    subject: "English",
    emoji: "📖",
    keywords: ["punctuation", "comma", "fullstop", "apostrophe", "colon", "semicolon", "rules"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "eng-essay-structure",
    question: "What is the structure of an essay?",
    answer:
      "A well-structured essay has three parts. Introduction: Hook the reader, give background, and state your thesis (main argument) in the last sentence. Body paragraphs (usually 2-3): Each paragraph focuses on ONE idea — start with a topic sentence, provide evidence/examples, and explain how they support your thesis. Conclusion: Restate the thesis in different words, summarize key points, and end with a memorable closing thought. Avoid introducing new ideas in the conclusion.",
    subject: "English",
    emoji: "📖",
    keywords: ["essay", "structure", "introduction", "body", "conclusion", "thesis", "paragraph"],
    classes: [8, 9, 10, 11, 12],
  },
  {
    id: "eng-paragraph-writing",
    question: "How do you write a good paragraph?",
    answer:
      "A good paragraph has: (1) Topic sentence — the main idea in the first sentence. (2) Supporting sentences — 3-4 sentences with details, examples, or evidence that explain the topic sentence. (3) Concluding sentence — wraps up the paragraph or transitions to the next. Keep one idea per paragraph. Use linking words (furthermore, however, therefore, in addition) to connect ideas smoothly. Aim for 5-8 sentences per paragraph.",
    subject: "English",
    emoji: "📖",
    keywords: ["paragraph", "writing", "topic sentence", "concluding", "support", "linking words"],
    classes: [7, 8, 9, 10],
  },

  // ─── History / Social Science ────────────────────────────────────────────────
  {
    id: "hist-french-revolution",
    question: "What were the causes of the French Revolution?",
    answer:
      "The French Revolution (1789) was caused by: (1) Financial crisis — France was bankrupt after wars including the American Revolution, leading to heavy taxation. (2) Social inequality — society was divided into 3 estates; the Third Estate (commoners) paid most taxes but had no rights. (3) Food shortages — bread prices rose, people starved. (4) Enlightenment ideas — philosophers like Rousseau and Voltaire spread ideas of liberty and equality. (5) Weak leadership of King Louis XVI.",
    subject: "History",
    emoji: "📜",
    keywords: ["french", "revolution", "causes", "1789", "estate", "louis", "enlightenment"],
    classes: [9, 10, 11],
  },
  {
    id: "hist-indian-independence",
    question: "What was the Indian Independence Movement?",
    answer:
      "India's freedom movement against British rule culminated in independence on 15 August 1947. Key events: 1857 Revolt (first war of independence), formation of Indian National Congress (1885), Partition of Bengal (1905), Non-Cooperation Movement (1920), Civil Disobedience Movement/Dandi March (1930), Quit India Movement (1942). Key leaders: Mahatma Gandhi (non-violence), Subhas Chandra Bose (INA), Bhagat Singh (revolutionary), Jawaharlal Nehru (first PM).",
    subject: "History",
    emoji: "📜",
    keywords: ["indian", "independence", "movement", "freedom", "gandhi", "1947", "british", "congress"],
    classes: [8, 9, 10, 11],
  },
  {
    id: "hist-world-war-1",
    question: "What were the causes of World War 1?",
    answer:
      "World War 1 (1914-1918) was caused by MAIN factors: Militarism (European powers built massive armies and navies), Alliance System (Europe split into two armed camps — Triple Entente vs Triple Alliance), Imperialism (competition for colonies created tensions), Nationalism (people demanded self-rule, especially in the Balkans). The immediate trigger was the assassination of Archduke Franz Ferdinand of Austria-Hungary in Sarajevo on 28 June 1914.",
    subject: "History",
    emoji: "📜",
    keywords: ["world war", "ww1", "causes", "1914", "main", "militarism", "alliance", "imperialism", "nationalism"],
    classes: [9, 10, 11],
  },
  {
    id: "hist-democracy",
    question: "What is democracy?",
    answer:
      "Democracy is a system of government where power belongs to the people. In a direct democracy, citizens vote on every issue. In a representative democracy (most countries, including India), people elect representatives to make decisions on their behalf. Key features: free and fair elections, universal adult franchise (voting rights for all adults), rule of law, fundamental rights, independent judiciary, freedom of speech and press. India is the world's largest democracy.",
    subject: "History",
    emoji: "📜",
    keywords: ["democracy", "government", "election", "representative", "rights", "vote"],
    classes: [9, 10, 11],
  },
  {
    id: "hist-mughal-empire",
    question: "What was the Mughal Empire?",
    answer:
      "The Mughal Empire (1526-1857) was one of the greatest empires in Indian history. Founded by Babur after the First Battle of Panipat (1526). Great rulers: Akbar (known for religious tolerance and administrative reforms), Jahangir (known for justice), Shah Jahan (built Taj Mahal), Aurangzeb (expanded the empire but religious policies caused conflicts). The empire declined after Aurangzeb due to weak successors and the rise of Marathas and British East India Company.",
    subject: "History",
    emoji: "📜",
    keywords: ["mughal", "empire", "akbar", "babur", "shah jahan", "taj mahal", "aurangzeb"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "hist-indian-constitution",
    question: "What are the basic features of the Indian Constitution?",
    answer:
      "The Indian Constitution came into effect on 26 January 1950 (Republic Day). Key features: Sovereign, Socialist, Secular, Democratic Republic (SSSR — from Preamble). Fundamental Rights (Part III) — 6 rights including Right to Equality, Freedom, Education. Directive Principles of State Policy guide the government. Fundamental Duties — 11 duties of citizens. Parliamentary system of government with President as head of state and PM as head of government. Federalism with strong centre.",
    subject: "History",
    emoji: "📜",
    keywords: ["constitution", "india", "fundamental rights", "preamble", "republic", "parliament"],
    classes: [9, 10, 11],
  },
  {
    id: "hist-industrial-revolution",
    question: "What was the Industrial Revolution?",
    answer:
      "The Industrial Revolution (1760s-1840s) was the shift from hand production to machine manufacturing, beginning in Britain. Key inventions: Steam engine (James Watt, 1769), Spinning Jenny, Power loom, Railways. Effects: mass production, urbanisation (people moved to cities for factory jobs), rise of middle class, environmental pollution. It spread to Europe and America and transformed society from agricultural to industrial. Child labour and poor working conditions were major problems.",
    subject: "History",
    emoji: "📜",
    keywords: ["industrial", "revolution", "steam", "engine", "britain", "factory", "1760"],
    classes: [9, 10, 11],
  },
  {
    id: "hist-maurya-empire",
    question: "What was the Maurya Empire?",
    answer:
      "The Maurya Empire (322-185 BCE) was India's first major empire. Founded by Chandragupta Maurya with help of Chanakya (Kautilya). Key rulers: Chandragupta Maurya (expelled Greeks, unified India), Bindusara, Ashoka the Great (after the Kalinga War, 261 BCE, converted to Buddhism and spread it across Asia). Ashoka's edicts are inscribed on pillars and rocks. The Lion Capital of Ashoka's pillar at Sarnath is India's national emblem.",
    subject: "History",
    emoji: "📜",
    keywords: ["maurya", "empire", "ashoka", "chandragupta", "chanakya", "buddhism", "india"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "hist-types-of-government",
    question: "What are types of government?",
    answer:
      "Types of government: Democracy — rule by the people (India, USA). Monarchy — rule by a king/queen (hereditary in Saudi Arabia, constitutional in UK). Oligarchy — rule by a small group. Dictatorship/Autocracy — rule by one person with absolute power (North Korea). Theocracy — rule based on religious law (Iran). Federal system — power shared between central and state governments (India, USA). Unitary system — central government is supreme (UK, France, China).",
    subject: "History",
    emoji: "📜",
    keywords: ["government", "types", "democracy", "monarchy", "dictatorship", "federal", "oligarchy"],
    classes: [9, 10, 11],
  },
  {
    id: "hist-preamble",
    question: "What is the Preamble to the Indian Constitution?",
    answer:
      "The Preamble is the introduction to the Indian Constitution declaring the ideals of the nation. Key words: 'We, the People of India' (source of authority is the people), Sovereign (independent), Socialist (economic equality), Secular (no state religion), Democratic (elected government), Republic (elected head of state). Objectives: Justice (social, economic, political), Liberty, Equality, Fraternity. The 42nd Amendment (1976) added 'Socialist' and 'Secular' to the Preamble.",
    subject: "History",
    emoji: "📜",
    keywords: ["preamble", "constitution", "sovereign", "socialist", "secular", "democratic", "republic"],
    classes: [9, 10, 11],
  },

  // ─── Geography ───────────────────────────────────────────────────────────────
  {
    id: "geo-latitude-longitude",
    question: "What is latitude and longitude?",
    answer:
      "Latitude and longitude are coordinates to locate any point on Earth. Latitude: horizontal lines parallel to the equator, measuring 0° (Equator) to 90° North or South. The Tropic of Cancer is at 23.5°N; Tropic of Capricorn at 23.5°S. Longitude: vertical lines from North to South Pole, measuring 0° (Prime Meridian/Greenwich) to 180° East or West. The International Date Line is at 180°. Together, latitude + longitude give the exact location of any place on Earth.",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["latitude", "longitude", "equator", "meridian", "coordinate", "tropic", "location"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "geo-types-of-rocks",
    question: "What are types of rocks?",
    answer:
      "Rocks are classified into three types: Igneous rocks (formed from cooled magma/lava — granite, basalt). Sedimentary rocks (formed from compressed layers of sediment — sandstone, limestone, coal). Metamorphic rocks (formed when existing rocks are changed by heat and pressure — marble from limestone, slate from shale). The rock cycle shows how rocks transform from one type to another over millions of years through geological processes.",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["rocks", "types", "igneous", "sedimentary", "metamorphic", "granite", "limestone", "marble"],
    classes: [7, 8, 9],
  },
  {
    id: "geo-monsoon",
    question: "How is monsoon formed?",
    answer:
      "Monsoon is the seasonal reversal of winds that brings heavy rainfall to South Asia. Formation: In summer, the Indian subcontinent heats up rapidly, creating a low-pressure area. Moist winds from the Indian Ocean rush in to fill this low pressure, bringing heavy rainfall (South-West Monsoon, June-September). In winter, the land cools faster than the ocean, reversing the wind direction (North-East Monsoon, October-November) bringing rain to Tamil Nadu's coast.",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["monsoon", "rain", "wind", "pressure", "season", "southwest", "northeast", "india"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "geo-climate-weather",
    question: "What is the difference between climate and weather?",
    answer:
      "Weather is the short-term atmospheric conditions of a specific place (temperature, rainfall, humidity, wind) on a particular day or week. Climate is the average weather pattern of a region over a long period (usually 30 years). Weather changes day to day; climate changes over decades. India has a tropical monsoon climate. A common phrase to remember: 'Climate is what you expect, weather is what you get.'",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["climate", "weather", "difference", "temperature", "rain", "atmosphere"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "geo-types-of-soil",
    question: "What are types of soil in India?",
    answer:
      "India has 6 major soil types: Alluvial soil (most fertile, found in Indo-Gangetic plains, good for wheat and rice), Black/Regur soil (found in Deccan plateau, retains moisture, good for cotton), Red soil (found in peninsular India, iron-rich), Laterite soil (found in heavy rainfall areas, leached of nutrients), Mountain/Forest soil (found in Himalayan region), Arid/Desert soil (found in Rajasthan, low organic content). Soil is vital for agriculture and is conserved through crop rotation and bunding.",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["soil", "type", "alluvial", "black", "red", "laterite", "india", "fertile"],
    classes: [8, 9, 10],
  },
  {
    id: "geo-natural-resources",
    question: "What are natural resources?",
    answer:
      "Natural resources are materials found in nature that humans use. Types: Renewable resources (can be replenished — sunlight, wind, water, forests), Non-renewable resources (limited supply, take millions of years to form — coal, petroleum, minerals). Biotic resources (living — fish, forests) and Abiotic resources (non-living — water, soil, minerals). Conservation is essential: use resources wisely, reduce-reuse-recycle, switch to renewable energy. India is rich in coal, iron ore, and bauxite.",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["natural", "resource", "renewable", "nonrenewable", "coal", "petroleum", "conservation"],
    classes: [8, 9, 10],
  },
  {
    id: "geo-gdp",
    question: "What is GDP?",
    answer:
      "GDP (Gross Domestic Product) is the total monetary value of all goods and services produced within a country's borders in a specific time period (usually one year). It measures a country's economic size. GDP per capita = GDP ÷ population (measures average living standard). High GDP indicates a strong economy. India's GDP ranks 5th largest in the world. GDP growth rate shows how fast an economy is growing. Factors affecting GDP: employment, investment, government spending, trade.",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["gdp", "gross", "domestic", "product", "economy", "income", "growth"],
    classes: [10, 11, 12],
  },
  {
    id: "geo-population",
    question: "What is population density?",
    answer:
      "Population density is the number of people living per unit area (usually per square kilometre). Formula: Population Density = Total Population ÷ Total Area. High density areas: urban areas, fertile plains (Uttar Pradesh, Bihar). Low density areas: deserts, mountains, forests (Arunachal Pradesh, Rajasthan desert). India's average density is about 382 persons/km² (2011 census). Factors affecting population distribution: availability of water, fertile soil, flat terrain, employment, climate.",
    subject: "Geography",
    emoji: "🗺️",
    keywords: ["population", "density", "distribution", "area", "urban", "rural"],
    classes: [8, 9, 10],
  },

  // ─── Computer Science ────────────────────────────────────────────────────────
  {
    id: "cs-what-is-computer",
    question: "What is a computer?",
    answer:
      "A computer is an electronic device that takes input, processes it, and gives output. It works on the IPO cycle: Input → Processing → Output. Main components: Input devices (keyboard, mouse), CPU — Central Processing Unit (brain of the computer that performs calculations), Memory/Storage (RAM for temporary storage, Hard disk for permanent storage), Output devices (monitor, printer). Computers work with binary (0s and 1s). Types: Supercomputers, Mainframes, Personal computers (desktops, laptops), tablets, smartphones.",
    subject: "Computer",
    emoji: "💻",
    keywords: ["computer", "cpu", "input", "output", "processing", "device", "electronic"],
    classes: [5, 6, 7, 8],
  },
  {
    id: "cs-software-types",
    question: "What are types of software?",
    answer:
      "Software is a set of instructions that tell a computer what to do. System Software: manages hardware and provides platform for other software (Operating System — Windows, Linux, macOS; Device drivers; BIOS). Application Software: performs specific user tasks (MS Word for documents, Chrome for browsing, VLC for media, Tally for accounts). Utility Software: maintains and optimizes the computer (Antivirus, Disk cleanup, File compression). Software is either paid (proprietary) or free (open-source like Linux, VLC).",
    subject: "Computer",
    emoji: "💻",
    keywords: ["software", "types", "system", "application", "utility", "operating system", "antivirus"],
    classes: [6, 7, 8, 9],
  },
  {
    id: "cs-internet",
    question: "What is the internet?",
    answer:
      "The internet is a global network of millions of computers and devices connected to each other, allowing sharing of information. It uses TCP/IP protocols to communicate. Key services: World Wide Web (websites), Email, Video calls, Cloud storage, Social media, Online gaming. Internet vs Web: Internet is the physical network; the Web (WWW) is a service that runs on the internet. Websites have unique addresses called URLs. A browser (Chrome, Firefox) is used to access websites.",
    subject: "Computer",
    emoji: "💻",
    keywords: ["internet", "network", "web", "www", "protocol", "browser", "website", "online"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "cs-ram-rom",
    question: "What is RAM and ROM?",
    answer:
      "RAM (Random Access Memory) is temporary memory that stores data currently being used. It is volatile — data is lost when power is off. More RAM = faster multitasking. Common sizes: 4GB, 8GB, 16GB. ROM (Read Only Memory) is permanent memory that stores the computer's firmware (BIOS). It is non-volatile — data is retained without power. You can read but not easily write to ROM. Unlike RAM, ROM content doesn't change with normal use. Secondary storage (Hard disk, SSD, Pen drive) is separate from both.",
    subject: "Computer",
    emoji: "💻",
    keywords: ["ram", "rom", "memory", "volatile", "storage", "primary", "secondary"],
    classes: [7, 8, 9, 10],
  },
  {
    id: "cs-binary",
    question: "What is the binary number system?",
    answer:
      "Binary is the number system used by computers, using only two digits: 0 and 1. Decimal (base 10) uses digits 0-9. Binary (base 2) uses 0 and 1 only. To convert decimal to binary: repeatedly divide by 2 and note remainders from bottom to top. Example: 13 in binary = 1101 (8+4+0+1). To convert binary to decimal: multiply each bit by its position value (1, 2, 4, 8...) and add. 1 byte = 8 bits; 1 KB = 1024 bytes; 1 MB = 1024 KB; 1 GB = 1024 MB.",
    subject: "Computer",
    emoji: "💻",
    keywords: ["binary", "number", "system", "bit", "byte", "decimal", "convert", "base"],
    classes: [8, 9, 10, 11],
  },
  {
    id: "cs-html",
    question: "What is HTML?",
    answer:
      "HTML (HyperText Markup Language) is the standard language for creating web pages. It uses tags (labels in angle brackets) to structure content. Basic structure: <!DOCTYPE html>, <html>, <head> (contains title, meta info), <body> (visible content). Common tags: <h1>-<h6> (headings), <p> (paragraph), <a href='...'> (link), <img> (image), <ul>/<ol>/<li> (lists), <table> (tables), <div> (container), <span> (inline container). HTML is NOT a programming language — it just structures content. CSS adds styling and JavaScript adds interactivity.",
    subject: "Computer",
    emoji: "💻",
    keywords: ["html", "web", "page", "tag", "markup", "language", "hypertext"],
    classes: [9, 10, 11, 12],
  },
  {
    id: "cs-input-output",
    question: "What are input and output devices?",
    answer:
      "Input devices send data to the computer: Keyboard (text input), Mouse (pointing/clicking), Scanner (digitizes documents), Microphone (audio input), Webcam (video input), Joystick (gaming), Touchscreen (touch input), Barcode reader. Output devices receive processed data from the computer: Monitor/Screen (visual output), Printer (prints documents), Speakers (audio output), Projector (large display). Some devices are both input and output: Touchscreen, Headphones with mic, Hard drives (read and write data).",
    subject: "Computer",
    emoji: "💻",
    keywords: ["input", "output", "device", "keyboard", "mouse", "monitor", "printer", "scanner"],
    classes: [5, 6, 7, 8],
  },
];

// ─── Search function ──────────────────────────────────────────────────────────

export function searchQuickAnswer(
  query: string,
  studentClass: number
): { answer: QuickAnswer; score: number } | null {
  const normalizedQuery = query.toLowerCase();
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 2);

  let bestMatch: { answer: QuickAnswer; score: number } | null = null;

  for (const qa of QUICK_ANSWERS) {
    if (!qa.classes.includes(studentClass)) continue;

    let score = 0;
    for (const kw of qa.keywords) {
      if (normalizedQuery.includes(kw)) score += 3;
    }
    for (const word of queryWords) {
      if (qa.question.toLowerCase().includes(word)) score += 1;
    }

    if (score >= 3 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { answer: qa, score };
    }
  }

  return bestMatch;
}

// ─── Complex question detector ────────────────────────────────────────────────

const COMPLEX_TRIGGERS = [
  "solve", "calculate", "derive", "proof", "step by step",
  "write an essay", "code", "algorithm", "compare and contrast",
  "evaluate", "explain the entire", "full explanation",
];

export function isComplexQuestion(query: string): boolean {
  if (query.length > 100) return true;
  const lower = query.toLowerCase();
  return COMPLEX_TRIGGERS.some((t) => lower.includes(t));
}

// ─── Subject sample questions (for pill suggestions) ─────────────────────────

export const SUBJECT_SAMPLES: Record<string, string> = {
  "Math 🔢":    "What is Pythagoras theorem?",
  "Science 🔬": "What is photosynthesis?",
  "English 📖": "What is active and passive voice?",
  "History 📜": "What were the causes of the French Revolution?",
  "Computer 💻":"What is RAM and ROM?",
};

export const EXAMPLE_QUESTIONS = [
  "What is Ohm's law?",
  "What is photosynthesis?",
  "What is Pythagoras theorem?",
];
