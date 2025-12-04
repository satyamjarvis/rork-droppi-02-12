import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import Colors from "../constants/colors";
import { User, UserRole } from "../types/models";

type CourierEditFormState = {
  name: string;
  phone: string;
  email: string;
  password: string;
  age: string;
  vehicle: string;
  profileEmail: string;
};

type BusinessEditFormState = {
  name: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  profileEmail: string;
};

type ManagerEditFormState = {
  name: string;
  phone: string;
  email: string;
  password: string;
};

type UserEditModalProps = {
  visible: boolean;
  user: User | null;
  isLoading: boolean;
  onClose: () => void;
  onSave: (payload: {
    userId: string;
    name?: string;
    phone?: string;
    email?: string;
    password?: string;
    courierProfile?: {
      age?: number;
      vehicle?: string;
      email?: string;
    };
    businessProfile?: {
      address?: string;
      email?: string;
    };
  }) => Promise<void>;
};

const placeholderColor = "rgba(15, 23, 42, 0.35)";

const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case "courier":
      return "שליח";
    case "business":
      return "עסק";
    case "manager":
      return "מנהל";
    default:
      return "משתמש";
  }
};

export function UserEditModal({
  visible,
  user,
  isLoading,
  onClose,
  onSave,
}: UserEditModalProps) {
  const [courierForm, setCourierForm] = useState<CourierEditFormState>({
    name: "",
    phone: "",
    email: "",
    password: "",
    age: "",
    vehicle: "",
    profileEmail: "",
  });

  const [businessForm, setBusinessForm] = useState<BusinessEditFormState>({
    name: "",
    phone: "",
    email: "",
    password: "",
    address: "",
    profileEmail: "",
  });

  const [managerForm, setManagerForm] = useState<ManagerEditFormState>({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (!user) return;

    if (user.role === "courier") {
      setCourierForm({
        name: user.name ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        password: "",
        age: user.courierProfile?.age?.toString() ?? "",
        vehicle: user.courierProfile?.vehicle ?? "",
        profileEmail: user.courierProfile?.email ?? "",
      });
    } else if (user.role === "business") {
      setBusinessForm({
        name: user.name ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        password: "",
        address: user.businessProfile?.address ?? "",
        profileEmail: user.businessProfile?.email ?? "",
      });
    } else if (user.role === "manager") {
      setManagerForm({
        name: user.name ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        password: "",
      });
    }
  }, [user]);

  const handleCourierFieldChange = useCallback(
    (field: keyof CourierEditFormState) => (value: string) => {
      setCourierForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const handleBusinessFieldChange = useCallback(
    (field: keyof BusinessEditFormState) => (value: string) => {
      setBusinessForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const handleManagerFieldChange = useCallback(
    (field: keyof ManagerEditFormState) => (value: string) => {
      setManagerForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!user) return;

    console.log("Saving user edit", user.id, user.role);

    if (user.role === "courier") {
      const payload: Parameters<typeof onSave>[0] = {
        userId: user.id,
      };

      if (courierForm.name.trim() && courierForm.name.trim() !== user.name) {
        payload.name = courierForm.name.trim();
      }
      if (courierForm.phone.trim() && courierForm.phone.trim() !== user.phone) {
        payload.phone = courierForm.phone.trim();
      }
      if (courierForm.email.trim() && courierForm.email.trim() !== user.email) {
        payload.email = courierForm.email.trim();
      }
      if (courierForm.password.trim().length >= 4) {
        payload.password = courierForm.password.trim();
      }

      const courierProfileUpdates: NonNullable<typeof payload.courierProfile> = {};
      const parsedAge = parseInt(courierForm.age, 10);
      if (!isNaN(parsedAge) && parsedAge !== user.courierProfile?.age) {
        courierProfileUpdates.age = parsedAge;
      }
      if (courierForm.vehicle.trim() && courierForm.vehicle.trim() !== user.courierProfile?.vehicle) {
        courierProfileUpdates.vehicle = courierForm.vehicle.trim();
      }
      if (courierForm.profileEmail.trim() && courierForm.profileEmail.trim() !== user.courierProfile?.email) {
        courierProfileUpdates.email = courierForm.profileEmail.trim();
      }

      if (Object.keys(courierProfileUpdates).length > 0) {
        payload.courierProfile = courierProfileUpdates;
      }

      await onSave(payload);
    } else if (user.role === "business") {
      const payload: Parameters<typeof onSave>[0] = {
        userId: user.id,
      };

      if (businessForm.name.trim() && businessForm.name.trim() !== user.name) {
        payload.name = businessForm.name.trim();
      }
      if (businessForm.phone.trim() && businessForm.phone.trim() !== user.phone) {
        payload.phone = businessForm.phone.trim();
      }
      if (businessForm.email.trim() && businessForm.email.trim() !== user.email) {
        payload.email = businessForm.email.trim();
      }
      if (businessForm.password.trim().length >= 4) {
        payload.password = businessForm.password.trim();
      }

      const businessProfileUpdates: NonNullable<typeof payload.businessProfile> = {};
      if (businessForm.address.trim() && businessForm.address.trim() !== user.businessProfile?.address) {
        businessProfileUpdates.address = businessForm.address.trim();
      }
      if (businessForm.profileEmail.trim() && businessForm.profileEmail.trim() !== user.businessProfile?.email) {
        businessProfileUpdates.email = businessForm.profileEmail.trim();
      }

      if (Object.keys(businessProfileUpdates).length > 0) {
        payload.businessProfile = businessProfileUpdates;
      }

      await onSave(payload);
    } else if (user.role === "manager") {
      const payload: Parameters<typeof onSave>[0] = {
        userId: user.id,
      };

      if (managerForm.name.trim() && managerForm.name.trim() !== user.name) {
        payload.name = managerForm.name.trim();
      }
      if (managerForm.phone.trim() && managerForm.phone.trim() !== user.phone) {
        payload.phone = managerForm.phone.trim();
      }
      if (managerForm.email.trim() && managerForm.email.trim() !== user.email) {
        payload.email = managerForm.email.trim();
      }
      if (managerForm.password.trim().length >= 4) {
        payload.password = managerForm.password.trim();
      }

      await onSave(payload);
    }
  }, [user, courierForm, businessForm, managerForm, onSave]);

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton} testID="close-edit-modal">
            <X color={Colors.light.text} size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>עריכת {getRoleLabel(user.role)}</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{getRoleLabel(user.role)}</Text>
          </View>

          {user.role === "courier" && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>שם מלא</Text>
                <TextInput
                  value={courierForm.name}
                  onChangeText={handleCourierFieldChange("name")}
                  style={styles.input}
                  placeholder="שם השליח"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="words"
                  testID="edit-courier-name"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>טלפון</Text>
                <TextInput
                  value={courierForm.phone}
                  onChangeText={handleCourierFieldChange("phone")}
                  style={styles.input}
                  placeholder="מספר טלפון"
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  testID="edit-courier-phone"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>אימייל</Text>
                <TextInput
                  value={courierForm.email}
                  onChangeText={handleCourierFieldChange("email")}
                  style={styles.input}
                  placeholder="כתובת אימייל"
                  placeholderTextColor={placeholderColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="edit-courier-email"
                />
              </View>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.inputHalf]}>
                  <Text style={styles.inputLabel}>גיל</Text>
                  <TextInput
                    value={courierForm.age}
                    onChangeText={handleCourierFieldChange("age")}
                    style={styles.input}
                    placeholder="גיל"
                    placeholderTextColor={placeholderColor}
                    keyboardType="number-pad"
                    maxLength={2}
                    testID="edit-courier-age"
                  />
                </View>
                <View style={[styles.inputGroup, styles.inputHalf]}>
                  <Text style={styles.inputLabel}>כלי תחבורה</Text>
                  <TextInput
                    value={courierForm.vehicle}
                    onChangeText={handleCourierFieldChange("vehicle")}
                    style={styles.input}
                    placeholder="כלי תחבורה"
                    placeholderTextColor={placeholderColor}
                    testID="edit-courier-vehicle"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>סיסמה חדשה (השאר ריק לשמור הנוכחית)</Text>
                <TextInput
                  value={courierForm.password}
                  onChangeText={handleCourierFieldChange("password")}
                  style={styles.input}
                  placeholder="סיסמה חדשה"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  testID="edit-courier-password"
                />
              </View>
            </View>
          )}

          {user.role === "business" && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>שם העסק</Text>
                <TextInput
                  value={businessForm.name}
                  onChangeText={handleBusinessFieldChange("name")}
                  style={styles.input}
                  placeholder="שם העסק"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="words"
                  testID="edit-business-name"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>טלפון</Text>
                <TextInput
                  value={businessForm.phone}
                  onChangeText={handleBusinessFieldChange("phone")}
                  style={styles.input}
                  placeholder="מספר טלפון"
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  testID="edit-business-phone"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>אימייל</Text>
                <TextInput
                  value={businessForm.email}
                  onChangeText={handleBusinessFieldChange("email")}
                  style={styles.input}
                  placeholder="כתובת אימייל"
                  placeholderTextColor={placeholderColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="edit-business-email"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>כתובת</Text>
                <TextInput
                  value={businessForm.address}
                  onChangeText={handleBusinessFieldChange("address")}
                  style={styles.input}
                  placeholder="כתובת העסק"
                  placeholderTextColor={placeholderColor}
                  testID="edit-business-address"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>סיסמה חדשה (השאר ריק לשמור הנוכחית)</Text>
                <TextInput
                  value={businessForm.password}
                  onChangeText={handleBusinessFieldChange("password")}
                  style={styles.input}
                  placeholder="סיסמה חדשה"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  testID="edit-business-password"
                />
              </View>
            </View>
          )}

          {user.role === "manager" && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>שם מלא</Text>
                <TextInput
                  value={managerForm.name}
                  onChangeText={handleManagerFieldChange("name")}
                  style={styles.input}
                  placeholder="שם המנהל"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="words"
                  testID="edit-manager-name"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>טלפון</Text>
                <TextInput
                  value={managerForm.phone}
                  onChangeText={handleManagerFieldChange("phone")}
                  style={styles.input}
                  placeholder="מספר טלפון"
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                  testID="edit-manager-phone"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>אימייל</Text>
                <TextInput
                  value={managerForm.email}
                  onChangeText={handleManagerFieldChange("email")}
                  style={styles.input}
                  placeholder="כתובת אימייל"
                  placeholderTextColor={placeholderColor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="edit-manager-email"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>סיסמה חדשה (השאר ריק לשמור הנוכחית)</Text>
                <TextInput
                  value={managerForm.password}
                  onChangeText={handleManagerFieldChange("password")}
                  style={styles.input}
                  placeholder="סיסמה חדשה"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  testID="edit-manager-password"
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={isLoading}
            style={[styles.saveButton, isLoading && styles.disabledButton]}
            testID="save-user-edit"
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.light.surface} />
            ) : (
              <Text style={styles.saveButtonText}>שמור שינויים</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  spacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  userInfo: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 16,
    backgroundColor: "#f8faff",
    borderRadius: 16,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.text,
    writingDirection: "rtl",
  },
  userRole: {
    fontSize: 14,
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  formContainer: {
    gap: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
  },
  inputGroup: {
    gap: 6,
    alignItems: "flex-end",
  },
  inputRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.secondaryText,
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: "#f8faff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.18)",
    textAlign: "right",
    writingDirection: "rtl",
    fontSize: 14,
    color: Colors.light.text,
    width: "100%",
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  saveButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.surface,
    writingDirection: "rtl",
  },
});
