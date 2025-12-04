import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "../constants/colors";

type AppErrorBoundaryState = {
  hasError: boolean;
};

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AppErrorBoundary caught", error, errorInfo);
  }

  handleReset = () => {
    console.log("AppErrorBoundary reset triggered");
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID="error-boundary">
          <Text style={styles.title}>אופס, משהו השתבש</Text>
          <Text style={styles.subtitle}>אנא נסו לרענן את המסך או להתחבר שוב</Text>
          <Pressable onPress={this.handleReset} style={styles.button} testID="error-boundary-reset">
            <Text style={styles.buttonText}>נסה שוב</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 8,
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 16,
    color: "#5b6573",
    textAlign: "center",
    marginBottom: 24,
    writingDirection: "rtl",
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    writingDirection: "rtl",
  },
});
