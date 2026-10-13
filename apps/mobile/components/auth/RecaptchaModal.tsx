// PATH: components/auth/RecaptchaModal.tsx
// Custom invisible-reCAPTCHA verifier for Firebase Auth phone sign-in (parent
// phone OTP on the registration screen). Firebase's JS SDK requires a real
// ApplicationVerifier ({ type: "recaptcha", verify(): Promise<string> }) for
// signInWithPhoneNumber — register.tsx used to pass `undefined`, which threw
// immediately and made every OTP send fail ("Failed to send OTP").
//
// This is a first-party reimplementation of the same technique
// expo-firebase-recaptcha uses (a WebView hosting Google's reCAPTCHA widget,
// bridged back to RN via postMessage) built directly on react-native-webview
// (already an app dependency) instead of that package, whose expo-firebase-core
// native dependency breaks the Android Gradle build on this Expo SDK. The
// WebView loads Firebase's web SDK from Google's own CDN inside its own
// sandboxed page context, so it has no relation to — and no compatibility
// concerns with — whatever Firebase JS SDK version the app itself uses.
//
// Usage:
//   const recaptchaRef = useRef<RecaptchaVerifierHandle>(null);
//   <RecaptchaModal ref={recaptchaRef} firebaseConfig={firebaseConfig} />
//   const token = await recaptchaRef.current!.verify();
//   const appVerifier = { type: "recaptcha", verify: async () => token };
//   await signInWithPhoneNumber(auth, phoneNumber, appVerifier);

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export interface RecaptchaVerifierHandle {
  verify: () => Promise<string>;
}

export interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

interface Props {
  firebaseConfig: FirebaseWebConfig;
  languageCode?: string;
}

function buildHtml(firebaseConfig: FirebaseWebConfig, invisible: boolean, languageCode?: string): string {
  return `<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
  <script>firebase.initializeApp(${JSON.stringify(firebaseConfig)});</script>
  <style>
    html, body { height: 100%; ${invisible ? "padding:0; margin:0;" : ""} }
    #recaptcha-btn { width: 100%; height: 100%; padding: 0; margin: 0; border: 0; }
  </style>
</head>
<body>
  ${invisible
    ? `<button id="recaptcha-btn" type="button" onclick="onClickButton()">Verify</button>`
    : `<div id="recaptcha-cont" class="g-recaptcha"></div>`}
  <script>
    var fullChallengeTimer;
    function onVerify(token) {
      if (fullChallengeTimer) { clearInterval(fullChallengeTimer); fullChallengeTimer = undefined; }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "verify", token: token }));
    }
    function onLoad() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "load" }));
      ${languageCode ? `firebase.auth().languageCode = "${languageCode}";` : ""}
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("${invisible ? "recaptcha-btn" : "recaptcha-cont"}", {
        size: "${invisible ? "invisible" : "normal"}",
        callback: onVerify
      });
      window.recaptchaVerifier.render();
    }
    function onError() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error" }));
    }
    function onClickButton() {
      if (!fullChallengeTimer) {
        fullChallengeTimer = setInterval(function() {
          var iframes = document.getElementsByTagName("iframe");
          var isFullChallenge = false;
          for (var i = 0; i < iframes.length; i++) {
            var parentWindow = iframes[i].parentNode ? iframes[i].parentNode.parentNode : undefined;
            var isHidden = parentWindow && parentWindow.style.opacity == 0;
            isFullChallenge = isFullChallenge || (!isHidden && (
              iframes[i].title === "recaptcha challenge" ||
              iframes[i].src.indexOf("google.com/recaptcha/api2/bframe") >= 0
            ));
          }
          if (isFullChallenge) {
            clearInterval(fullChallengeTimer);
            fullChallengeTimer = undefined;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "fullChallenge" }));
          }
        }, 100);
      }
    }
    window.addEventListener("message", function(event) {
      if (event.data && event.data.verify) {
        document.getElementById("recaptcha-btn").click();
      }
    });
  </script>
  <script src="https://www.google.com/recaptcha/api.js?onload=onLoad&render=explicit&hl=${languageCode ?? ""}" onerror="onError()"></script>
</body></html>`;
}

const TRIGGER_JS = `
(function(){ window.dispatchEvent(new MessageEvent('message', { data: { verify: true } })); })();
true;
`;

const RecaptchaModal = forwardRef<RecaptchaVerifierHandle, Props>(
  ({ firebaseConfig, languageCode }, ref) => {
    const invisibleRef = useRef<WebView>(null);
    const [invisibleKey, setInvisibleKey] = useState(0);
    const invisibleLoadedRef = useRef(false);
    const pendingTriggerRef = useRef(false);

    const [visible, setVisible] = useState(false);
    const [visibleLoaded, setVisibleLoaded] = useState(false);

    const pendingRef = useRef<{ resolve: (token: string) => void; reject: (err: Error) => void } | null>(null);

    const settle = useCallback((fn: "resolve" | "reject", value: any) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) pending[fn](value);
    }, []);

    const handleInvisibleMessage = useCallback((event: WebViewMessageEvent) => {
      let data: any;
      try { data = JSON.parse(event.nativeEvent.data); } catch { return; }

      if (data.type === "load") {
        invisibleLoadedRef.current = true;
        if (pendingTriggerRef.current) {
          pendingTriggerRef.current = false;
          invisibleRef.current?.injectJavaScript(TRIGGER_JS);
        }
      } else if (data.type === "verify") {
        settle("resolve", data.token);
        invisibleLoadedRef.current = false;
        setInvisibleKey((k) => k + 1);
      } else if (data.type === "error") {
        settle("reject", new Error("Failed to load reCAPTCHA"));
      } else if (data.type === "fullChallenge") {
        // Invisible check decided a real challenge is needed — fall back to
        // a visible modal, matching Google's own recommended UX for this.
        setVisible(true);
      }
    }, [settle]);

    const handleVisibleMessage = useCallback((event: WebViewMessageEvent) => {
      let data: any;
      try { data = JSON.parse(event.nativeEvent.data); } catch { return; }

      if (data.type === "load") {
        setVisibleLoaded(true);
      } else if (data.type === "verify") {
        setVisible(false);
        setVisibleLoaded(false);
        settle("resolve", data.token);
      } else if (data.type === "error") {
        setVisible(false);
        setVisibleLoaded(false);
        settle("reject", new Error("Failed to load reCAPTCHA"));
      }
    }, [settle]);

    const cancelVisible = useCallback(() => {
      setVisible(false);
      setVisibleLoaded(false);
      settle("reject", new Error("Verification cancelled"));
    }, [settle]);

    useImperativeHandle(ref, () => ({
      verify: () =>
        new Promise<string>((resolve, reject) => {
          pendingRef.current = { resolve, reject };
          if (invisibleLoadedRef.current) {
            invisibleRef.current?.injectJavaScript(TRIGGER_JS);
          } else {
            pendingTriggerRef.current = true;
          }
        }),
    }), []);

    return (
      <View style={styles.hidden}>
        <WebView
          key={`invisible-${invisibleKey}`}
          ref={invisibleRef}
          javaScriptEnabled
          source={{ html: buildHtml(firebaseConfig, true, languageCode), baseUrl: `https://${firebaseConfig.authDomain}` }}
          onMessage={handleInvisibleMessage}
          style={styles.invisibleWebview}
        />

        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancelVisible}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Verify you&apos;re human</Text>
              <TouchableOpacity onPress={cancelVisible} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.content}>
              <WebView
                javaScriptEnabled
                source={{ html: buildHtml(firebaseConfig, false, languageCode), baseUrl: `https://${firebaseConfig.authDomain}` }}
                onMessage={handleVisibleMessage}
                style={styles.content}
              />
              {!visibleLoaded && (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" />
                </View>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    );
  }
);

RecaptchaModal.displayName = "RecaptchaModal";
export default RecaptchaModal;

const styles = StyleSheet.create({
  hidden: { position: "absolute", width: 0, height: 0, overflow: "hidden" },
  invisibleWebview: { width: 300, height: 300 },
  modalContainer: { flex: 1 },
  header: {
    height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#CECECE", backgroundColor: "#FBFBFB",
  },
  title: { fontWeight: "700" },
  cancelBtn: { position: "absolute", left: 12, padding: 4 },
  cancelText: { color: "#6366F1", fontWeight: "600" },
  content: { flex: 1 },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start", alignItems: "center", paddingTop: 20 },
});
