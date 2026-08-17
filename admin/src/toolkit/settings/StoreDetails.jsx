import React from "react";
import { Store } from "lucide-react";
import {
  Card,
  Field,
  TextInput,
  TextArea,
  SelectField,
  SettingsPanel,
} from "./FormControls";
import {
  useSettingsSection,
  isEmail,
  isMobile,
  isPincode,
  INDIAN_STATES,
} from "./settingsApi";

const DEFAULTS = {
  storeName: "",
  legalName: "",
  supportEmail: "",
  billingEmail: "",
  mobile: "",
  altMobile: "",
  whatsapp: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  storeTimings: "",
};

function validate(form) {
  return {
    storeName: form.storeName.trim() ? "" : "Store name is required.",
    supportEmail: !form.supportEmail.trim()
      ? "A contact email is required."
      : isEmail(form.supportEmail)
        ? ""
        : "Enter a valid email address.",
    billingEmail:
      !form.billingEmail.trim() || isEmail(form.billingEmail)
        ? ""
        : "Enter a valid email address.",
    mobile: !form.mobile.trim()
      ? "A contact number is required."
      : isMobile(form.mobile)
        ? ""
        : "Enter a valid 10-digit Indian mobile number.",
    altMobile: !form.altMobile.trim() || isMobile(form.altMobile) ? "" : "Enter a valid mobile number.",
    whatsapp: !form.whatsapp.trim() || isMobile(form.whatsapp) ? "" : "Enter a valid mobile number.",
    addressLine1: form.addressLine1.trim() ? "" : "Address is required.",
    city: form.city.trim() ? "" : "City is required.",
    state: form.state ? "" : "Select a state.",
    pincode: !form.pincode.trim()
      ? "PIN code is required."
      : isPincode(form.pincode)
        ? ""
        : "Enter a valid 6-digit PIN code.",
  };
}

export default function StoreDetails() {
  const state = useSettingsSection("store-details", DEFAULTS, validate);
  const { form, update, errors } = state;

  return (
    <SettingsPanel
      icon={Store}
      title="Store Details"
      description="Name, address and contact information shown across the storefront and invoices."
      state={state}
    >
      <Card
        title="Business identity"
        description="How your store is named for customers and on legal documents."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Store name" required error={errors.storeName} hint="Shown in the header, emails and page titles.">
            <TextInput
              placeholder="JAAPA"
              value={form.storeName}
              error={errors.storeName}
              onChange={(e) => update("storeName", e.target.value)}
            />
          </Field>
          <Field label="Registered legal name" hint="Used on invoices — leave blank to use the store name.">
            <TextInput
              placeholder="JAAPA Ayurveda Pvt. Ltd."
              value={form.legalName}
              onChange={(e) => update("legalName", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Contact" description="Where customers reach you. These appear on the contact page and in order emails.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Support email" required error={errors.supportEmail}>
            <TextInput
              type="email"
              placeholder="care@jaapa.in"
              value={form.supportEmail}
              error={errors.supportEmail}
              onChange={(e) => update("supportEmail", e.target.value)}
            />
          </Field>
          <Field label="Billing email" error={errors.billingEmail} hint="Invoices and payout notices go here.">
            <TextInput
              type="email"
              placeholder="accounts@jaapa.in"
              value={form.billingEmail}
              error={errors.billingEmail}
              onChange={(e) => update("billingEmail", e.target.value)}
            />
          </Field>
          <Field label="Mobile number" required error={errors.mobile}>
            <TextInput
              inputMode="tel"
              placeholder="98765 43210"
              value={form.mobile}
              error={errors.mobile}
              onChange={(e) => update("mobile", e.target.value)}
            />
          </Field>
          <Field label="Alternate number" error={errors.altMobile}>
            <TextInput
              inputMode="tel"
              placeholder="Optional"
              value={form.altMobile}
              error={errors.altMobile}
              onChange={(e) => update("altMobile", e.target.value)}
            />
          </Field>
          <Field label="WhatsApp number" error={errors.whatsapp} hint="Used for the floating chat button on the storefront.">
            <TextInput
              inputMode="tel"
              placeholder="Optional"
              value={form.whatsapp}
              error={errors.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
            />
          </Field>
          <Field label="Store timings" hint="Free text, e.g. Mon–Sat, 10 AM – 7 PM.">
            <TextInput
              placeholder="Mon–Sat, 10 AM – 7 PM"
              value={form.storeTimings}
              onChange={(e) => update("storeTimings", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Registered address" description="Used as the pickup address for shipping and the seller address on invoices.">
        <div className="flex flex-col gap-4">
          <Field label="Address line 1" required error={errors.addressLine1}>
            <TextArea
              rows={2}
              placeholder="Building, street"
              value={form.addressLine1}
              error={errors.addressLine1}
              onChange={(e) => update("addressLine1", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Address line 2">
              <TextInput
                placeholder="Area, locality"
                value={form.addressLine2}
                onChange={(e) => update("addressLine2", e.target.value)}
              />
            </Field>
            <Field label="Landmark">
              <TextInput
                placeholder="Optional"
                value={form.landmark}
                onChange={(e) => update("landmark", e.target.value)}
              />
            </Field>
            <Field label="City" required error={errors.city}>
              <TextInput
                placeholder="Indore"
                value={form.city}
                error={errors.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>
            <Field label="State" required error={errors.state}>
              <SelectField
                placeholder="Select state"
                value={form.state}
                error={errors.state}
                onChange={(e) => update("state", e.target.value)}
                options={INDIAN_STATES.map((s) => s.name)}
              />
            </Field>
            <Field label="PIN code" required error={errors.pincode}>
              <TextInput
                inputMode="numeric"
                maxLength={6}
                placeholder="452001"
                value={form.pincode}
                error={errors.pincode}
                onChange={(e) => update("pincode", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="Country">
              <TextInput
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>
    </SettingsPanel>
  );
}
