"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { connectWallet, getAccounts, getEthereumProvider } from "./client";

interface WalletValue {
  address: string | null;
  hasWallet: boolean;
  error: string | null;
  connect: () => Promise<void>;
}

const WalletContext = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getEthereumProvider();
    setHasWallet(provider !== null);
    if (!provider) return;
    getAccounts().then((accounts) => setAddress(accounts[0] ?? null));
    const onAccounts = (accounts: string[]) => setAddress(accounts?.[0] ?? null);
    provider.on?.("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      setAddress(await connectWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return <WalletContext.Provider value={{ address, hasWallet, error, connect }}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
