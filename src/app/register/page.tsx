'use client';

import { Building2, User, Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, Input, Card } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    title: 'Notar',
    email: '',
    password: '',
    organizationName: '',
    officialSeat: '',
    chamberDistrict: 'Westfälische Notarkammer',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registrierung fehlgeschlagen.');
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unerwarteter Fehler bei der Registrierung.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>
        <h1 className="text-foreground text-3xl font-bold tracking-tight">Kanzlei registrieren</h1>
        <p className="text-muted-foreground mt-2 text-base leading-relaxed">
          Erstellen Sie Ihr Notariat und starten Sie mit digitaler Urkunden- und Vorgangsanalyse
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <Card className="px-6 py-8 shadow-sm sm:px-10">
          {isSuccess ? (
            <div className="space-y-4 py-8 text-center">
              <div className="bg-notar-100 text-notar-900 border-notar-300 mx-auto flex h-14 w-14 items-center justify-center rounded-full border">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-foreground text-2xl font-bold">
                Kanzlei erfolgreich registriert!
              </h2>
              <p className="text-muted-foreground text-base">
                Ihr Notariat wurde angelegt. Sie werden automatisch zum Arbeitsbereich
                weitergeleitet...
              </p>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-base text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Section: Notar/Inhaber Angaben */}
              <div className="space-y-4">
                <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
                  <User className="text-muted-foreground h-5 w-5" />
                  <span>Angaben zur Amtsperson (Inhaber/Notar)</span>
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Input
                      id="fullName"
                      name="fullName"
                      label="Vollständiger Name"
                      required
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Dr. Max Mustermann"
                    />
                  </div>
                  <div>
                    <Input
                      id="title"
                      name="title"
                      label="Amtsbezeichnung"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="Notar"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    label="Amts-E-Mail-Adresse"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="kanzlei@notar-beispiel.de"
                    leftIcon={<Mail className="h-5 w-5" />}
                  />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    label="Passwort"
                    helperText="Mindestens 8 Zeichen"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    leftIcon={<Lock className="h-5 w-5" />}
                  />
                </div>
              </div>

              {/* Section: Kanzlei Angaben */}
              <div className="border-border space-y-4 border-t pt-6">
                <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
                  <Building2 className="text-muted-foreground h-5 w-5" />
                  <span>Kanzlei- und Notariatsdaten</span>
                </h2>

                <Input
                  id="organizationName"
                  name="organizationName"
                  label="Kanzleiname / Notariatsbezeichnung"
                  required
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder="Notariat Mustermann & Partner"
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    id="officialSeat"
                    name="officialSeat"
                    label="Amtssitz"
                    required
                    value={formData.officialSeat}
                    onChange={handleChange}
                    placeholder="Münster"
                  />
                  <div className="w-full space-y-1.5">
                    <label
                      htmlFor="chamberDistrict"
                      className="text-foreground block text-base font-medium"
                    >
                      Zuständige Notarkammer
                    </label>
                    <select
                      id="chamberDistrict"
                      name="chamberDistrict"
                      value={formData.chamberDistrict}
                      onChange={handleChange}
                      className="border-input bg-background text-foreground focus:ring-notar-900 block min-h-11 w-full cursor-pointer rounded-lg border px-3.5 py-2.5 text-base focus:ring-2 focus:outline-none"
                    >
                      <option value="Westfälische Notarkammer">Westfälische Notarkammer</option>
                      <option value="Rheinische Notarkammer">Rheinische Notarkammer</option>
                      <option value="Notarkammer Berlin">Notarkammer Berlin</option>
                      <option value="Landesnotarkammer Bayern">Landesnotarkammer Bayern</option>
                      <option value="Notarkammer Frankfurt am Main">
                        Notarkammer Frankfurt am Main
                      </option>
                      <option value="Hamburgische Notarkammer">Hamburgische Notarkammer</option>
                      <option value="Notarkammer Baden-Württemberg">
                        Notarkammer Baden-Württemberg
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isLoading}
                  className="w-full justify-center"
                  rightIcon={<ArrowRight className="h-5 w-5" />}
                >
                  Kanzlei jetzt registrieren
                </Button>
              </div>
            </form>
          )}

          {/* Footer Login Link */}
          <div className="border-border mt-8 border-t pt-5 text-center">
            <p className="text-muted-foreground text-base">
              Bereits registriert?{' '}
              <Link href="/login" className="text-notar-900 font-semibold hover:underline">
                Zur Anmeldung
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
