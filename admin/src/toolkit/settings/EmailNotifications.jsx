import React from "react";
import { Mail } from "lucide-react";
import {
  Card,
  Field,
  TextInput,
  TextArea,
  Switch,
  SettingsPanel,
  Banner,
} from "./FormControls";
import { useSettingsSection, isEmail } from "./settingsApi";

const DEFAULTS = {
  senderName: "",
  fromEmail: "",
  replyToEmail: "",
  bccEmail: "",
  footerText: "",
  notifications: {
    orderPlaced: true,
    orderShipped: true,
    orderDelivered: true,
    orderCancelled: true,
    refundIssued: true,
    abandonedCart: false,
    welcome: false,
  },
};

// id must match a key in DEFAULTS.notifications.
const NOTIFICATION_TYPES = [
  { id: "orderPlaced", label: "Order confirmation", description: "Sent as soon as payment succeeds." },
  { id: "orderShipped", label: "Order shipped", description: "Includes the tracking link when one is added." },
  { id: "orderDelivered", label: "Order delivered", description: "Sent when an order is marked delivered." },
  { id: "orderCancelled", label: "Order cancelled", description: "Sent when you or the customer cancels an order." },
  { id: "refundIssued", label: "Refund issued", description: "Confirms the refunded amount and method." },
  { id: "abandonedCart", label: "Abandoned cart reminder", description: "Sent 24 hours after a cart is left behind." },
  { id: "welcome", label: "Welcome email", description: "Sent when a customer creates an account." },
];

function validate(form) {
  return {
    senderName: form.senderName.trim() ? "" : "Sender name is required — customers see this first.",
    fromEmail: !form.fromEmail.trim()
      ? "A from address is required."
      : isEmail(form.fromEmail)
        ? ""
        : "Enter a valid email address.",
    replyToEmail:
      !form.replyToEmail.trim() || isEmail(form.replyToEmail) ? "" : "Enter a valid email address.",
    bccEmail: !form.bccEmail.trim() || isEmail(form.bccEmail) ? "" : "Enter a valid email address.",
  };
}

// Mimics how the sender line renders in an inbox.
function InboxPreview({ senderName, fromEmail }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <p className="mb-2 text-xs font-medium text-gray-400">How it looks in the customer's inbox</p>
      <div className="rounded-lg bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">
          {senderName || "Your store name"}{" "}
          <span className="font-normal text-gray-400">
            &lt;{fromEmail || "orders@yourstore.in"}&gt;
          </span>
        </p>
        <p className="mt-0.5 text-sm text-gray-700">Your JAAPA order #10023 is confirmed</p>
        <p className="mt-0.5 truncate text-xs text-gray-400">
          Thanks for your order — we're packing it now and will let you know the moment it ships.
        </p>
      </div>
    </div>
  );
}

export default function EmailNotifications() {
  const state = useSettingsSection("email-notifications", DEFAULTS, validate);
  const { form, update, errors } = state;

  function toggleNotification(id, value) {
    update("notifications", { ...form.notifications, [id]: value });
  }

  return (
    <SettingsPanel
      icon={Mail}
      title="Email Notifications"
      description="The address customers receive order emails from, and which emails go out."
      state={state}
    >
      <Card title="Sender identity" description="Applied to every automated email your store sends.">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Sender name"
              required
              error={errors.senderName}
              hint="The name shown in the inbox — usually your store name."
            >
              <TextInput
                placeholder="JAAPA"
                value={form.senderName}
                error={errors.senderName}
                onChange={(e) => update("senderName", e.target.value)}
              />
            </Field>
            <Field
              label="From email address"
              required
              error={errors.fromEmail}
              hint="Customers receive notifications from this address."
            >
              <TextInput
                type="email"
                placeholder="orders@jaapa.in"
                value={form.fromEmail}
                error={errors.fromEmail}
                onChange={(e) => update("fromEmail", e.target.value)}
              />
            </Field>
            <Field
              label="Reply-to address"
              error={errors.replyToEmail}
              hint="Where replies land. Leave blank to use the from address."
            >
              <TextInput
                type="email"
                placeholder="care@jaapa.in"
                value={form.replyToEmail}
                error={errors.replyToEmail}
                onChange={(e) => update("replyToEmail", e.target.value)}
              />
            </Field>
            <Field
              label="BCC address"
              error={errors.bccEmail}
              hint="Optional — keeps a silent copy of every customer email."
            >
              <TextInput
                type="email"
                placeholder="archive@jaapa.in"
                value={form.bccEmail}
                error={errors.bccEmail}
                onChange={(e) => update("bccEmail", e.target.value)}
              />
            </Field>
          </div>

          <InboxPreview senderName={form.senderName} fromEmail={form.fromEmail} />

          <Banner tone="info">
            Emails send from this address only once its domain is verified with your email provider.
            Until then, delivery may fail or land in spam.
          </Banner>
        </div>
      </Card>

      <Card title="Which emails go out" description="Turn off anything you'd rather send by hand.">
        <div className="flex flex-col divide-y divide-gray-50">
          {NOTIFICATION_TYPES.map((type) => (
            <div key={type.id} className="py-3.5 first:pt-0 last:pb-0">
              <Switch
                checked={Boolean(form.notifications[type.id])}
                onChange={(value) => toggleNotification(type.id, value)}
                label={type.label}
                description={type.description}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Email footer" description="Appears at the bottom of every email — usually your address and an unsubscribe note.">
        <Field label="Footer text">
          <TextArea
            rows={3}
            placeholder="JAAPA Ayurveda, Indore, Madhya Pradesh · You're receiving this because you placed an order with us."
            value={form.footerText}
            onChange={(e) => update("footerText", e.target.value)}
          />
        </Field>
      </Card>
    </SettingsPanel>
  );
}
