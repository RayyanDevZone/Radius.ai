import type { Locale } from "./config";

const en = {
  home: {
    badge: "Welcome",
    tagline: "Welcome to Radius.ai. We're glad you're here.",
    continue: "Continue",
  },
  language: {
    badge: "Step 1",
    // Heading is rendered as: before + <accent> + after
    titleBefore: "Choose your ",
    titleAccent: "language",
    titleAfter: "",
    continue: "Continue",
  },
  auth: {
    signInTitle: "Sign in",
    signUpTitle: "Create an account",
    name: "Name",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Sign up",
    pending: "Please wait…",
    haveAccount: "Already have an account?",
    noAccount: "No account?",
    errors: {
      invalidCredentials: "Invalid email or password.",
      userExists: "An account with this email already exists.",
      passwordTooShort: "Password must be at least 8 characters.",
      generic: "Something went wrong. Please try again.",
    },
  },
  dashboard: {
    title: "Dashboard",
    signedInAs: "Signed in as",
    dbTime: "Database time",
    signOut: "Sign out",
  },
};

export type Dictionary = typeof en;

const hi: Dictionary = {
  home: {
    badge: "स्वागत है",
    tagline: "Radius.ai में आपका स्वागत है। हमें खुशी है कि आप यहाँ हैं।",
    continue: "जारी रखें",
  },
  language: {
    badge: "चरण 1",
    titleBefore: "अपनी ",
    titleAccent: "भाषा",
    titleAfter: " चुनें",
    continue: "जारी रखें",
  },
  auth: {
    signInTitle: "साइन इन करें",
    signUpTitle: "खाता बनाएँ",
    name: "नाम",
    email: "ईमेल",
    password: "पासवर्ड",
    signIn: "साइन इन करें",
    signUp: "साइन अप करें",
    pending: "कृपया प्रतीक्षा करें…",
    haveAccount: "पहले से खाता है?",
    noAccount: "खाता नहीं है?",
    errors: {
      invalidCredentials: "ईमेल या पासवर्ड गलत है।",
      userExists: "इस ईमेल से पहले से एक खाता मौजूद है।",
      passwordTooShort: "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।",
      generic: "कुछ गलत हो गया। कृपया फिर से कोशिश करें।",
    },
  },
  dashboard: {
    title: "डैशबोर्ड",
    signedInAs: "साइन इन किया गया:",
    dbTime: "डेटाबेस समय",
    signOut: "साइन आउट करें",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, hi };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
