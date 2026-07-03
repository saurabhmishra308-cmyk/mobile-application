// A small modal that collects a recipient email and triggers
// POST /api/email-report on our backend, then closes.

import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmailKind, emailReport, getAuthToken } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

const LABELS: Record<EmailKind, string> = {
  flowmeter_csv: "Flowmeter · CSV",
  flowmeter_pdf: "Flowmeter · PDF",
  dwlr_csv: "DWLR · CSV",
  dwlr_pdf: "DWLR · PDF",
};

export function EmailReportSheet({
  visible,
  onClose,
  defaultRecipient,
  initialKinds,
  hardwareId,
  days,
  subject,
  title = "Send report by email",
  helper = "Delivered from info@envirolytics.in with the CSV/PDF attached.",
}: {
  visible: boolean;
  onClose: () => void;
  defaultRecipient?: string;
  initialKinds: EmailKind[];
  hardwareId?: string;
  days?: number;
  subject?: string;
  title?: string;
  helper?: string;
}) {
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [kinds, setKinds] = useState<EmailKind[]>(initialKinds);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    if (visible) {
      setRecipient(defaultRecipient || "");
      setKinds(initialKinds);
      setMessage(null);
      setNote("");
      setSending(false);
    }
  }, [visible, defaultRecipient, initialKinds]);

  const toggleKind = (k: EmailKind) => {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const onSend = async () => {
    if (!recipient.trim()) {
      setMessage({ type: "error", text: "Please enter a recipient email address." });
      return;
    }
    if (!kinds.length) {
      setMessage({ type: "error", text: "Pick at least one attachment." });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("You need to sign in again.");
      const res = await emailReport({
        recipient: recipient.trim(),
        envirolytics_token: token,
        kinds,
        hardware_id: hardwareId,
        days,
        subject,
        note: note.trim() || undefined,
      });
      setMessage({
        type: "success",
        text: `Sent ${res.count} file${res.count === 1 ? "" : "s"} to ${res.recipient}.`,
      });
      // Auto-close on success.
      setTimeout(onClose, 1600);
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Failed to send email." });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          testID="email-sheet-backdrop"
        />
        <View style={styles.sheet} testID="email-sheet">
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>EMAIL DELIVERY</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} testID="email-sheet-close">
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.helper}>{helper}</Text>

          <Text style={styles.label}>RECIPIENT</Text>
          <TextInput
            testID="email-recipient-input"
            style={styles.input}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="you@company.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>MESSAGE · OPTIONAL</Text>
          <TextInput
            testID="email-note-input"
            style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note to the email body…"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.label}>ATTACHMENTS</Text>
          <View style={styles.chipRow}>
            {(Object.keys(LABELS) as EmailKind[]).map((k) => {
              const active = kinds.includes(k);
              return (
                <TouchableOpacity
                  key={k}
                  testID={`email-kind-${k}`}
                  onPress={() => toggleKind(k)}
                  style={[
                    styles.chip,
                    active && {
                      backgroundColor: "rgba(16,185,129,0.15)",
                      borderColor: colors.eco,
                    },
                  ]}
                >
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={13}
                    color={active ? colors.eco : colors.textMuted}
                  />
                  <Text style={[styles.chipText, active && { color: colors.eco }]}>
                    {LABELS[k]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {message ? (
            <View
              style={[
                styles.msg,
                {
                  backgroundColor:
                    message.type === "success"
                      ? "rgba(16,185,129,0.10)"
                      : "rgba(239,68,68,0.12)",
                  borderColor:
                    message.type === "success"
                      ? "rgba(16,185,129,0.30)"
                      : "rgba(239,68,68,0.30)",
                },
              ]}
              testID="email-sheet-message"
            >
              <Ionicons
                name={message.type === "success" ? "checkmark-circle" : "alert-circle"}
                size={16}
                color={message.type === "success" ? colors.eco : colors.danger}
              />
              <Text
                style={[
                  styles.msgText,
                  { color: message.type === "success" ? colors.eco : colors.danger },
                ]}
              >
                {message.text}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            testID="email-sheet-send"
            style={[styles.sendBtn, sending && { opacity: 0.7 }]}
            onPress={onSend}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="mail-outline" size={16} color="#fff" />
                <Text style={styles.sendText}>Send Email</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "800", marginTop: 2 },
  helper: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md },
  label: {
    color: colors.textSecondary,
    fontSize: 10.5,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginTop: spacing.md,
    marginBottom: 6,
  },
  input: {
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  msg: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  msgText: { flex: 1, fontSize: 12.5 },
  sendBtn: {
    marginTop: spacing.lg,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.eco,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: colors.eco,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
});
