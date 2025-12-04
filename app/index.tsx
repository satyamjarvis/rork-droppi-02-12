import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Mail } from "lucide-react-native";

import Colors from "../constants/colors";
import { useDelivery } from "../providers/DeliveryProvider";
import { UserRole } from "../types/models";

type VisibleRole = Extract<UserRole, "courier" | "business">;

const roleLabels: Record<VisibleRole, string> = {
  business: "בית עסק",
  courier: "שליח",
};

export default function LoginScreen() {
  const router = useRouter();
  const { user, login, loginMutationStatus } = useDelivery();
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<VisibleRole>("courier");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const isSubmitting = loginMutationStatus === "pending";

  useEffect(() => {
    if (user) {
      const targetRoute =
        user.role === "business"
          ? "/my-deliveries"
          : user.role === "courier"
            ? "/my-deliveries"
            : "/management-dashboard";
      router.replace(targetRoute);
    }
  }, [router, user]);

  const handleRoleSelect = (role: VisibleRole) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch((error) => {
        console.log("Haptics selection failed", error);
      });
    } else {
      console.log("Haptics selection fallback");
    }
    setRoleFilter(role);
  };

  const visibleRoles: VisibleRole[] = ["courier", "business"];

  const handleLogin = async () => {
    console.log("Login button pressed", { phoneAttemptLength: phone.length, roleFilter });
    setErrorMessage(null);
    
    if (!phone.trim()) {
      setErrorMessage("יש להזין מספר טלפון");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("יש להזין סיסמה");
      return;
    }
    
    try {
      console.log("Attempting login...");
      const result = await login({ phone: phone.trim(), password: password.trim() });
      if (result && result.id) {
        console.log("Login successful, user:", result.id);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((hapticError) => {
            console.log("Haptics notification failed", hapticError);
          });
        }
      }
    } catch (error) {
      console.log("Login error caught:", error);
      let nextMessage = "תקלה בהתחברות";
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        console.log("Error message:", msg);
        
        if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("abort")) {
          nextMessage = "בעיית חיבור לשרת - נסה שוב";
        } else if (msg.includes("timeout") || msg.includes("request timeout")) {
          nextMessage = "השרת עמוס - נסה שוב בעוד רגע";
        } else if (msg.includes("פרטי הכניסה שגויים")) {
          nextMessage = "מספר טלפון או סיסמה שגויים";
        } else if (msg.includes("לא זמין") || msg.includes("not configured")) {
          nextMessage = "השרת אינו זמין כרגע";
        } else if (msg.includes("מספר הטלפון") && msg.includes("תקין")) {
          nextMessage = "מספר הטלפון שהוזן אינו תקין";
        } else if (msg.includes("נסה שוב מאוחר יותר") || msg.includes("שגיאה בהתחברות")) {
          nextMessage = "אירעה שגיאה - נסה שוב";
        } else {
          nextMessage = error.message;
        }
      }
      setErrorMessage(nextMessage);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch((notificationError) => {
          console.log("Haptics error failed", notificationError);
        });
      }
    }
  };

  const handleEmailPress = async () => {
    const mailtoLink = "mailto:razsavoyy@gmail.com";
    try {
      const supported = await Linking.canOpenURL(mailtoLink);
      if (!supported) {
        Alert.alert("שגיאה", "לא ניתן לפתוח אפליקציית דוא\"ל במכשיר זה");
        return;
      }
      await Linking.openURL(mailtoLink);
    } catch (error) {
      console.log("Email launch failed", error);
      Alert.alert("שגיאה", "לא הצלחנו לפתוח את הדוא\"ל");
    }
  };

  return (
    <LinearGradient
      colors={[Colors.light.background, "#ffffff"]}
      style={[styles.gradient, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      locations={[0, 1]}
    >
      <KeyboardAvoidingView
        style={styles.avoiding}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          testID="login-scroll"
        >
          <View style={styles.headerWrapper}>
            <Text style={styles.brandTitle}>Droppi</Text>
            <Text style={styles.pageTitle}>התחברות</Text>
            <Text style={styles.subtitle}>כניסה מאובטחת לשליחים ובתי עסק</Text>
          </View>

          <View style={styles.roleSelector} testID="role-selector">
            {visibleRoles.map((roleKey) => (
              <Pressable
                key={roleKey}
                onPress={() => handleRoleSelect(roleKey)}
                style={[styles.rolePill, roleFilter === roleKey && styles.rolePillActive]}
                testID={`role-${roleKey}`}
              >
                <Text style={[styles.rolePillText, roleFilter === roleKey && styles.rolePillTextActive]}>
                  {roleLabels[roleKey]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>מספר טלפון</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="הקלידו מספר טלפון"
              placeholderTextColor="#9ba3b8"
              keyboardType="phone-pad"
              style={styles.input}
              autoCapitalize="none"
              testID="input-phone"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>סיסמה</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="הקלידו סיסמה"
              placeholderTextColor="#9ba3b8"
              secureTextEntry
              style={styles.input}
              testID="input-password"
            />
          </View>

          <Pressable
            onPress={handleLogin}
            style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]}
            disabled={isSubmitting}
            testID="login-button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>התחבר</Text>
            )}
          </Pressable>

          {errorMessage ? (
            <LinearGradient
              colors={["rgba(239, 68, 68, 0.38)", "rgba(239, 68, 68, 0.08)"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.errorNotice}
            >
              <View style={styles.errorNoticeContent} testID="login-error">
                <Text style={styles.errorNoticeHeading}>משהו השתבש</Text>
                <Text style={styles.errorNoticeText}>{errorMessage}</Text>
              </View>
            </LinearGradient>
          ) : null}

          <View style={styles.registrationNoticeWrapper} testID="registration-notice">
            <LinearGradient
              colors={["rgba(29, 78, 216, 0.18)", "rgba(29, 78, 216, 0.06)"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.registrationNoticeGradient}
            >
              <View style={styles.registrationNoticeContent}>
                <View style={styles.registrationNoticeTextWrapper}>
                  <Text style={styles.registrationNoticeHeading}>הרשמה חדשה</Text>
                  <Text style={styles.registrationNoticeText}>
                    להרשמה כשליח או בית עסק יש ליצור קשר עם המפעילים.
                  </Text>
                </View>
                <Pressable
                  onPress={handleEmailPress}
                  style={styles.emailButton}
                  testID="email-contact-button"
                >
                  <Mail color={Colors.light.surface} size={20} />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  avoiding: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 24,
  },
  headerWrapper: {
    alignItems: "flex-end",
    gap: 8,
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: "800",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.secondaryText,
    textAlign: "right",
    writingDirection: "rtl",
  },
  roleSelector: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "flex-start",
  },
  rolePill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "rgba(29, 78, 216, 0.08)",
  },
  rolePillActive: {
    backgroundColor: Colors.light.tint,
  },
  rolePillText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontWeight: "600",
    writingDirection: "rtl",
  },
  rolePillTextActive: {
    color: "#ffffff",
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    textAlign: "right",
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    fontSize: 16,
    color: Colors.light.text,
    textAlign: "right",
    writingDirection: "rtl",
  },
  loginButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    writingDirection: "rtl",
  },
  registrationNoticeWrapper: {
    marginTop: 12,
  },
  errorNotice: {
    borderRadius: 18,
    padding: 1,
  },
  errorNoticeContent: {
    borderRadius: 17,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    alignItems: "flex-end",
    gap: 6,
  },
  errorNoticeHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#b91c1c",
    writingDirection: "rtl",
  },
  errorNoticeText: {
    fontSize: 14,
    color: "#7f1d1d",
    writingDirection: "rtl",
    textAlign: "right",
    lineHeight: 18,
  },
  registrationNoticeGradient: {
    borderRadius: 22,
    padding: 1,
  },
  registrationNoticeContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
    borderRadius: 21,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  registrationNoticeTextWrapper: {
    flex: 1,
    gap: 4,
    alignItems: "flex-end",
  },
  registrationNoticeHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.tint,
    writingDirection: "rtl",
  },
  registrationNoticeText: {
    fontSize: 15,
    color: Colors.light.secondaryText,
    lineHeight: 20,
    writingDirection: "rtl",
    textAlign: "right",
  },
  emailButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    width: 52,
    height: 52,
    borderRadius: 26,
    elevation: Platform.OS === "android" ? 2 : 0,
    shadowColor: Platform.OS === "ios" ? "rgba(15, 23, 42, 0.2)" : undefined,
    shadowOpacity: Platform.OS === "ios" ? 0.2 : 0,
    shadowRadius: Platform.OS === "ios" ? 6 : 0,
    shadowOffset: Platform.OS === "ios" ? { width: 0, height: 4 } : undefined,
  }
});
