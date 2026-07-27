import { useState, useEffect, useMemo, useRef } from "react";
import {
  Camera, Check, ChevronLeft, Search, X, PackageX, TrendingUp, TrendingDown, Minus,
  MapPin, LocateFixed, Link2, CircleDollarSign, Sparkles, LogOut, Loader2, Plus, RefreshCw,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const fmt = (v) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function freshnessLabel(dateStr) {
  const d = daysAgo(dateStr);
  if (d === null) return { text: "Nikdy", tone: "stale" };
  if (d <= 0) return { text: "Dnes", tone: "fresh" };
  if (d === 1) return { text: "Včera", tone: "fresh" };
  if (d <= 6) return { text: `Před ${d} dny`, tone: "ok" };
  return { text: `Před ${d} dny`, tone: "stale" };
}

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const [pos, setPos] = useState(null);

  const request = () => {
    if (!navigator.geolocation) {
      setLocError("Zařízení nepodporuje GPS.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("Poloha nedostupná — povolte přístup k GPS.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return { locating, locError, pos, request };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) setProfileError(error.message);
        else setProfile(data);
      });
  }, [session]);

  return { session, profile, profileError };
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Nesprávný e-mail nebo heslo.");
  };

  return (
    <div className="min-h-screen bg-app text-white flex flex-col justify-center px-6">
      <div className="text-xs uppercase tracking-[0.2em] text-amber font-semibold mb-2 text-center">
        Kontrola cen
      </div>
      <h1 className="font-display text-4xl leading-tight text-center mb-8">Přihlášení</h1>
      <form onSubmit={submit} className="space-y-3 max-w-sm mx-auto w-full">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="w-full bg-surface border border-hair2 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Heslo"
          className="w-full bg-surface border border-hair2 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber"
        />
        {error && <div className="text-red text-xs text-center">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber text-app rounded-xl py-3.5 font-semibold active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="spin" />}
          Přihlásit se
        </button>
      </form>
    </div>
  );
}

function NoProfileScreen({ email }) {
  return (
    <div className="min-h-screen bg-app text-white flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl mb-3">Účet zatím není nastavený</h1>
      <p className="text-secondary text-sm max-w-sm mb-6">
        Přihlášení proběhlo úspěšně ({email}), ale váš účet ještě nemá
        přiřazenou roli v systému. Požádejte administrátora, ať vás přidá do
        tabulky <code className="text-strong">users</code>.
      </p>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-sm text-secondary underline"
      >
        Odhlásit se
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hlavní appka
// ---------------------------------------------------------------------------

export default function App() {
  const { session, profile, profileError } = useAuth();

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <Loader2 size={24} className="spin text-amber" />
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  if (profileError || profile === null) {
    // profile === null jen dokud se nenačte; profileError znamená skutečný problém
    if (!profileError) {
      return (
        <div className="min-h-screen bg-app flex items-center justify-center">
          <Loader2 size={24} className="spin text-amber" />
        </div>
      );
    }
    return <NoProfileScreen email={session.user.email} />;
  }

  return <MainApp profile={profile} />;
}

function MainApp({ profile }) {
  const [chains, setChains] = useState([]);
  const [chainId, setChainId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(null);

  const [products, setProducts] = useState([]);
  const [listings, setListings] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingBranchData, setLoadingBranchData] = useState(false);

  const [activeGroup, setActiveGroup] = useState("Vše");
  const [onlyPriced, setOnlyPriced] = useState(false);
  const [onlyGrouped, setOnlyGrouped] = useState(false);
  const [query, setQuery] = useState("");
  const [sheetItem, setSheetItem] = useState(null);
  const [toast, setToast] = useState(null);

  const chain = chains.find((c) => c.id === chainId) || null;
  const branch = branches.find((b) => b.id === branchId) || null;

  // Načíst řetězce jednou při startu
  useEffect(() => {
    supabase
      .from("chains")
      .select("*")
      .order("name")
      .then(({ data }) => setChains(data || []));
  }, []);

  // Načíst prodejny při výběru řetězce
  useEffect(() => {
    if (!chainId) return;
    supabase
      .from("branches")
      .select("*")
      .eq("chain_id", chainId)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setBranches(data || []));
  }, [chainId]);

  const loadChainData = async (cId) => {
    setLoadingBranchData(true);
    const [productsRes, listingsRes, groupsRes] = await Promise.all([
      supabase.from("products").select("*, product_groups(name)").eq("active", true),
      supabase.from("listings").select("*").eq("chain_id", cId),
      supabase.from("product_groups").select("*").order("name"),
    ]);
    setProducts(productsRes.data || []);
    setListings(listingsRes.data || []);
    setGroups((groupsRes.data || []).map((g) => g.name));
    setLoadingBranchData(false);
  };

  const pickChain = (id) => {
    setChainId(id);
    setBranchId(null);
    setBranches([]);
  };

  const pickBranch = (id) => {
    setBranchId(id);
    setActiveGroup("Vše");
    setOnlyPriced(false);
    setOnlyGrouped(false);
    setQuery("");
    loadChainData(chainId);
  };

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2500);
  };

  // Spojit produkty s jejich zalistováním v aktuálním řetězci (cena je sdílená
  // napříč pobočkami — pobočka je jen informace, kde byla naposledy zjištěna).
  const merged = useMemo(() => {
    return products.map((p) => {
      const listing = listings.find((l) => l.product_id === p.id) || null;
      const checkedBranch = listing?.last_checked_branch_id
        ? branches.find((b) => b.id === listing.last_checked_branch_id)
        : null;
      return {
        id: p.id,
        name: p.name,
        group: p.product_groups?.name || "Ostatní",
        price_group_id: p.price_group_id,
        price: listing?.current_price ?? null,
        prev: listing?.previous_price ?? null,
        checkedAt: listing?.last_checked_at ?? null,
        checkedBranchName: checkedBranch?.name ?? null,
        checkedBranchIsCurrent: listing?.last_checked_branch_id === branchId,
        onShelf: listing?.on_shelf ?? true,
        listingId: listing?.id ?? null,
      };
    });
  }, [products, listings, branches, branchId]);

  const unpricedCount = merged.filter((p) => p.price == null).length;

  const filtered = useMemo(() => {
    return merged
      .filter((p) => activeGroup === "Vše" || p.group === activeGroup)
      .filter((p) => !onlyPriced || p.price != null)
      .filter((p) => !onlyGrouped || p.price_group_id != null)
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  }, [merged, activeGroup, onlyPriced, onlyGrouped, query]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      map[p.group] = map[p.group] || [];
      map[p.group].push(p);
    });
    return map;
  }, [filtered]);

  // Obnovit data automaticky, když se uživatel do appky vrátí (přepnutí appek,
  // uzamčená obrazovka apod.) — nespoléhat jen na ruční tlačítko.
  useEffect(() => {
    if (!branchId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") loadChainData(chainId);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [branchId, chainId]);

  const checkedToday = merged.filter((p) => daysAgo(p.checkedAt) === 0).length;

  const siblings = sheetItem
    ? merged.filter((p) => sheetItem.price_group_id && p.price_group_id === sheetItem.price_group_id && p.id !== sheetItem.id)
    : [];

  const saveListing = async (targetIds, patch, msg) => {
    const now = new Date().toISOString();
    for (const id of targetIds) {
      const existing = merged.find((p) => p.id === id);
      const { data: listingRow, error: listingErr } = await supabase
        .from("listings")
        .upsert(
          {
            product_id: id,
            chain_id: chainId,
            current_price: patch.price !== undefined ? patch.price : existing?.price ?? null,
            previous_price: patch.price !== undefined ? existing?.price ?? null : existing?.prev ?? null,
            on_shelf: patch.onShelf !== undefined ? patch.onShelf : true,
            last_checked_at: now,
            last_checked_by: profile.id,
            last_checked_branch_id: branchId,
          },
          { onConflict: "product_id,chain_id" }
        )
        .select()
        .single();

      if (listingErr) {
        showToast("Chyba při ukládání: " + listingErr.message);
        continue;
      }

      await supabase.from("price_history").insert({
        listing_id: listingRow.id,
        price: patch.price !== undefined ? patch.price : existing?.price ?? null,
        on_shelf: patch.onShelf !== undefined ? patch.onShelf : true,
        source: "manual",
        recorded_by: profile.id,
        branch_id: branchId,
        client_recorded_at: now,
      });
    }
    await loadChainData(chainId);
    setSheetItem(null);
    showToast(msg);
  };

  if (!chainId) {
    return <ChainPicker chains={chains} onPick={pickChain} profile={profile} />;
  }
  if (!branchId) {
    return (
      <BranchPicker
        chain={chain}
        branches={branches}
        onPick={pickBranch}
        onBack={() => setChainId(null)}
        onBranchAdded={(b) => setBranches((prev) => [...prev, b])}
      />
    );
  }

  return (
    <div className="min-h-screen bg-app text-white pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-app border-b border-hair">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            onClick={() => setBranchId(null)}
            className="w-9 h-9 rounded-full bg-surface flex items-center justify-center active:scale-95 transition"
            aria-label="Zpět na výběr prodejny"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display text-2xl leading-none tracking-wide truncate" style={{ color: chain.accent_color || "#FFB020" }}>
              {chain.name.toUpperCase()} <span className="text-secondary">— {branch.name}</span>
            </div>
            <div className="text-xs text-secondary mt-0.5">
              {loadingBranchData ? "Načítám…" : `${merged.length} položek · dnes zkontrolováno ${checkedToday}`}
            </div>
          </div>
          <button
            onClick={() => loadChainData(chainId)}
            disabled={loadingBranchData}
            className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0 disabled:opacity-50"
            aria-label="Obnovit data"
            title="Obnovit sortiment a ceny"
          >
            <RefreshCw size={15} className={`text-secondary ${loadingBranchData ? "spin" : ""}`} />
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0"
            aria-label="Odhlásit se"
            title={profile.full_name}
          >
            <LogOut size={15} className="text-secondary" />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5 border border-hair2">
            <Search size={16} className="text-secondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Najít v sortimentu…"
              className="bg-transparent outline-none text-sm flex-1 text-white"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Vymazat hledání">
                <X size={15} className="text-secondary" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar items-center">
          {["Vše", ...groups].map((g) => {
            const active = activeGroup === g;
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                  active ? "bg-amber text-app border-amber" : "bg-transparent text-strong border-hair2"
                }`}
              >
                {g}
              </button>
            );
          })}
          <div className="w-px h-5 shrink-0 bg-hair2" />
          <button
            onClick={() => setOnlyPriced((v) => !v)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
              onlyPriced ? "bg-green/10 text-green border-green/40" : "bg-transparent text-strong border-hair2"
            }`}
          >
            <CircleDollarSign size={14} /> Jen s cenou
          </button>
          <button
            onClick={() => setOnlyGrouped((v) => !v)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
              onlyGrouped ? "bg-amber/10 text-amber border-amber/40" : "bg-transparent text-strong border-hair2"
            }`}
          >
            <Link2 size={14} /> Skupinové ceny
          </button>
        </div>
      </div>

      {!onlyPriced && unpricedCount > 0 && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5 bg-amber/10 border border-amber/30">
          <Sparkles size={14} className="text-amber shrink-0" />
          <span className="text-xs text-strong">
            {unpricedCount} {unpricedCount === 1 ? "nová položka čeká" : "nové položky čekají"} na první cenu v této prodejně
          </span>
        </div>
      )}

      <div className="px-4 mt-3 space-y-6">
        {loadingBranchData && (
          <div className="text-center text-faint text-sm py-16 flex items-center justify-center gap-2">
            <Loader2 size={16} className="spin" /> Načítám sortiment…
          </div>
        )}
        {!loadingBranchData && Object.keys(grouped).length === 0 && (
          <div className="text-center text-faint text-sm py-16">Nic neodpovídá hledání.</div>
        )}
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div className="text-xs uppercase tracking-[0.14em] text-faint font-semibold mb-2 px-1">
              {group} · {items.length}
            </div>
            <div className="space-y-2">
              {items.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  linkedCount={p.price_group_id ? merged.filter((x) => x.price_group_id === p.price_group_id).length - 1 : 0}
                  onOpen={() => setSheetItem(p)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {sheetItem && (
        <EditSheet
          product={sheetItem}
          siblings={siblings}
          onClose={() => setSheetItem(null)}
          onSave={saveListing}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-app text-sm font-medium px-4 py-2.5 rounded-full shadow-lg z-50 flex items-center gap-2">
          <Check size={15} /> {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ChainMark({ chain, size = 48 }) {
  return (
    <div
      className="rounded-xl flex items-center justify-center font-display shrink-0"
      style={{ width: size, height: size, background: chain.accent_color || "#FFB020", color: "#fff", fontSize: size * 0.42 }}
    >
      {chain.name?.[0]}
    </div>
  );
}

function ChainPicker({ chains, onPick, profile }) {
  return (
    <div className="min-h-screen bg-app text-white flex flex-col">
      <div className="px-6 pt-16 pb-6 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-amber font-semibold mb-2">Kontrola cen</div>
          <h1 className="font-display text-4xl leading-tight">Vyberte řetězec</h1>
          <p className="text-sm text-secondary mt-2">Přihlášen jako {profile.full_name}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center shrink-0 mt-1"
          aria-label="Odhlásit se"
        >
          <LogOut size={15} className="text-secondary" />
        </button>
      </div>
      <div className="px-6 flex-1 space-y-3">
        {chains.length === 0 && (
          <div className="text-center text-faint text-sm py-16 flex items-center justify-center gap-2">
            <Loader2 size={16} className="spin" /> Načítám řetězce…
          </div>
        )}
        {chains.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className="bg-surface hover:bg-surfaceRaised border border-hair rounded-2xl px-5 py-5 text-left transition active:scale-[0.98] w-full flex items-center gap-4"
          >
            <ChainMark chain={c} />
            <div className="flex-1 min-w-0">
              <div className="font-display text-2xl leading-none">{c.name}</div>
            </div>
            <ChevronLeft size={18} className="rotate-180 text-faint shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function BranchPicker({ chain, branches, onPick, onBack, onBranchAdded }) {
  const { locating, locError, pos, request } = useGeolocation();
  const [adding, setAdding] = useState(false);

  const withDistance = useMemo(() => {
    const list = branches.map((b) => ({ ...b, distance: pos && b.lat && b.lng ? distanceKm(pos, b) : null }));
    if (pos) list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return list;
  }, [branches, pos]);

  return (
    <div className="min-h-screen bg-app text-white flex flex-col">
      <div className="px-4 pt-5 pb-2 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-surface flex items-center justify-center active:scale-95 transition"
          aria-label="Zpět na výběr řetězce"
        >
          <ChevronLeft size={18} />
        </button>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-lg"
          style={{ background: (chain?.accent_color || "#FFB020") + "22", color: chain?.accent_color || "#FFB020" }}
        >
          {chain?.name?.[0]}
        </div>
        <div className="font-display text-xl">{chain?.name}</div>
      </div>

      <div className="px-6 pt-3 pb-4">
        <h1 className="font-display text-3xl leading-tight">Vyberte prodejnu</h1>
        <p className="text-sm text-secondary mt-1">Konkrétní pobočka, kde se ceny monitorují.</p>
      </div>

      <div className="px-6 mb-4">
        <button
          onClick={request}
          disabled={locating}
          className="w-full flex items-center justify-center gap-2 border border-hair2 rounded-xl py-3 text-sm font-medium text-strong active:scale-[0.98] transition"
        >
          <LocateFixed size={16} className={locating ? "spin text-amber" : "text-amber"} />
          {locating ? "Zjišťuji polohu…" : pos ? "Seřazeno podle vzdálenosti" : "Seřadit podle mé polohy"}
        </button>
        {locError && <div className="text-xs text-red mt-2 text-center">{locError}</div>}
      </div>

      <div className="px-6 flex-1 space-y-3 pb-6">
        {withDistance.length === 0 && !adding && <div className="text-center text-faint text-sm py-10">Pro tento řetězec zatím nejsou založené prodejny.</div>}
        {withDistance.map((b) => (
          <button
            key={b.id}
            onClick={() => onPick(b.id)}
            className="bg-surface hover:bg-surfaceRaised border border-hair rounded-2xl px-5 py-4 text-left transition active:scale-[0.98] w-full flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="font-display text-xl leading-none">{b.name}</div>
              <div className="text-xs text-secondary mt-1.5 flex items-center gap-1">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{b.address || "Adresa nevyplněna"}</span>
              </div>
            </div>
            {b.distance != null && (
              <div className="text-xs font-mono text-strong shrink-0">
                {b.distance < 1 ? `${Math.round(b.distance * 1000)} m` : `${b.distance.toFixed(1)} km`}
              </div>
            )}
            <ChevronLeft size={18} className="rotate-180 text-faint shrink-0" />
          </button>
        ))}
      </div>

      <div className="px-6 pb-10">
        {adding ? (
          <AddBranchForm
            chainId={chain.id}
            gpsPos={pos}
            onCancel={() => setAdding(false)}
            onCreated={(branch) => {
              setAdding(false);
              onBranchAdded(branch);
              onPick(branch.id);
            }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-hair2 rounded-xl py-3.5 text-sm font-medium text-amber active:scale-[0.98] transition"
          >
            <Plus size={16} /> Pobočka chybí — přidat novou
          </button>
        )}
      </div>
    </div>
  );
}

// Reverzní geokódování přes OpenStreetMap Nominatim (zdarma, bez API klíče).
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

function AddBranchForm({ chainId, gpsPos, onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState(gpsPos?.lat ?? "");
  const [lng, setLng] = useState(gpsPos?.lng ?? "");
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const useMyLocation = async () => {
    if (!navigator.geolocation) return;
    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      const la = p.coords.latitude;
      const ln = p.coords.longitude;
      setLat(la);
      setLng(ln);
      const addr = await reverseGeocode(la, ln);
      if (addr) setAddress(addr);
      setGeocoding(false);
    }, () => setGeocoding(false), { enableHighAccuracy: true, timeout: 8000 });
  };

  const save = async () => {
    if (!name.trim()) { setError("Zadejte název pobočky."); return; }
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("branches")
      .insert({
        chain_id: chainId,
        name: name.trim(),
        address: address.trim() || null,
        lat: lat === "" ? null : Number(lat),
        lng: lng === "" ? null : Number(lng),
      })
      .select()
      .single();
    setSaving(false);
    if (error) setError(error.message.includes("duplicate") ? "Pobočka s tímto názvem už u řetězce existuje." : error.message);
    else onCreated(data);
  };

  return (
    <div className="bg-surface border border-amber/40 rounded-2xl p-4 space-y-2.5">
      <div className="text-sm font-medium text-strong flex items-center gap-1.5">
        <Plus size={14} className="text-amber" /> Nová pobočka
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Název pobočky (např. Na Chodově)"
        className="w-full bg-app border border-hair2 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber text-white"
      />
      <button
        onClick={useMyLocation}
        disabled={geocoding}
        className="w-full flex items-center justify-center gap-2 border border-hair2 rounded-lg py-2.5 text-sm text-strong active:scale-[0.98] transition"
      >
        <LocateFixed size={14} className={geocoding ? "spin text-amber" : "text-amber"} />
        {geocoding ? "Zjišťuji polohu a adresu…" : "Použít moji polohu (doplní souřadnice i adresu)"}
      </button>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Adresa (jde upravit ručně)"
        className="w-full bg-app border border-hair2 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber text-white"
      />
      {lat !== "" && lng !== "" && (
        <div className="text-xs text-faint font-mono">GPS: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</div>
      )}
      {error && <div className="text-xs text-red">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-amber text-app rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="spin" />}
          Vytvořit a otevřít
        </button>
        <button onClick={onCancel} className="px-4 rounded-lg border border-hair2 text-sm text-secondary">Zrušit</button>
      </div>
    </div>
  );
}

function ProductRow({ product, linkedCount, onOpen }) {
  const unpriced = product.price == null;
  const fresh = freshnessLabel(product.checkedAt);
  const toneClass = { fresh: "text-green", ok: "text-amber", stale: "text-muted" }[fresh.tone];

  let trend = null;
  if (product.prev != null && product.checkedAt) {
    if (product.price > product.prev) trend = "up";
    else if (product.price < product.prev) trend = "down";
    else trend = "flat";
  }

  const borderClass = unpriced ? "border-dashed border-[#4A3B14]" : product.onShelf ? "border-hair" : "border-redSoft";

  return (
    <button
      onClick={onOpen}
      className={`ticket w-full flex items-center gap-3 bg-surface rounded-r-xl rounded-l-md pl-5 pr-3.5 py-3.5 text-left transition active:scale-[0.98] border ${borderClass} ${!product.onShelf ? "opacity-85" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium truncate">{product.name}</div>
        <div className="flex items-center gap-2 mt-1">
          {unpriced ? (
            <span className="flex items-center gap-1 text-xs text-amber font-medium">
              <Sparkles size={11} /> Nezalistováno — klepněte pro cenu
            </span>
          ) : !product.onShelf ? (
            <span className="flex items-center gap-1 text-xs text-red font-medium">
              <PackageX size={12} /> Není na regálu
            </span>
          ) : (
            <span className={`text-xs ${toneClass}`}>{fresh.text}</span>
          )}
          {!unpriced && product.checkedBranchName && !product.checkedBranchIsCurrent && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <MapPin size={10} /> zjištěno v {product.checkedBranchName}
            </span>
          )}
          {linkedCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted bg-surfaceRaised rounded-full px-1.5 py-0.5">
              <Link2 size={10} /> +{linkedCount} stejná cena
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        {unpriced ? (
          <div className="font-mono text-lg font-semibold text-faint">— Kč</div>
        ) : product.onShelf ? (
          <div className="font-mono text-lg font-semibold flex items-center gap-1 justify-end">
            {trend === "up" && <TrendingUp size={13} className="text-red" />}
            {trend === "down" && <TrendingDown size={13} className="text-green" />}
            {trend === "flat" && <Minus size={13} className="text-muted" />}
            {fmt(product.price)} Kč
          </div>
        ) : (
          <div className="font-mono text-lg font-semibold text-muted line-through">{fmt(product.price)} Kč</div>
        )}
        {product.prev != null && product.prev !== product.price && (
          <div className="text-xs text-muted font-mono">{fmt(product.prev)} Kč dříve</div>
        )}
      </div>
    </button>
  );
}

function EditSheet({ product, siblings, onClose, onSave }) {
  const unpriced = product.price == null;
  const [price, setPrice] = useState(unpriced ? "" : String(product.price).replace(".", ","));
  const [scanning, setScanning] = useState(false);
  const [applyToGroup, setApplyToGroup] = useState(true);
  const [excluded, setExcluded] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const parsed = parseFloat(price.replace(",", "."));
  const valid = !Number.isNaN(parsed) && parsed > 0;
  const hasGroup = siblings.length > 0;
  const includedSiblings = siblings.filter((s) => !excluded.has(s.id));

  const toggleSibling = (id) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mockScan = () => {
    setScanning(true);
    window.setTimeout(() => {
      const base = unpriced ? 50 : product.price;
      const guess = (base + (Math.random() > 0.5 ? 1 : -1) * Math.random() * 5).toFixed(2);
      setPrice(guess.replace(".", ","));
      setScanning(false);
    }, 1100);
  };

  const savePrice = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const targetIds = applyToGroup && hasGroup ? [product.id, ...includedSiblings.map((s) => s.id)] : [product.id];
    const msg = unpriced ? "Položka zalistována" : targetIds.length > 1 ? `Cena uložena pro ${targetIds.length} položky` : "Cena uložena";
    await onSave(targetIds, { price: parsed, onShelf: true }, msg);
    setSaving(false);
  };

  const markMissing = async () => {
    if (saving) return;
    setSaving(true);
    await onSave([product.id], { onShelf: false }, "Označeno jako chybějící");
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface rounded-t-3xl px-5 pt-3 pb-8 animate-slide-up max-h-[88vh] overflow-y-auto border-t border-x border-hair2">
        <div className="w-10 h-1 rounded-full mx-auto mb-4 bg-[#3A3F46]" />

        <div className="mb-5">
          <div className="text-xs uppercase tracking-wide text-secondary flex items-center gap-1.5">
            {product.group}
            {unpriced && (
              <span className="text-amber flex items-center gap-1">
                <Sparkles size={11} /> nová položka
              </span>
            )}
          </div>
          <div className="font-display text-2xl leading-tight mt-0.5">{product.name}</div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={mockScan} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mb-4 text-sm text-strong border border-dashed border-[#3A3F46] active:scale-[0.98] transition"
        >
          <Camera size={16} />
          {scanning ? "Čtu cenovku…" : "Vyfotit cenovku a načíst cenu"}
        </button>

        <label className="text-xs text-secondary mb-1.5 block">
          {unpriced ? "Cena na regálu (zalistuje položku)" : "Aktuální cena na regálu"}
        </label>
        <div className="flex items-center gap-2 bg-app rounded-xl px-4 py-3 mb-2 border border-hair2">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            autoFocus={unpriced}
            className="font-mono text-2xl bg-transparent outline-none flex-1 min-w-0 text-white"
          />
          <span className="text-muted font-mono text-lg">Kč</span>
        </div>
        {product.prev != null && <div className="text-xs text-muted font-mono mb-4">Dříve: {fmt(product.prev)} Kč</div>}

        {hasGroup && (
          <div className="mb-5">
            <button
              onClick={() => setApplyToGroup((v) => !v)}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition border ${
                applyToGroup ? "border-amber bg-amber/10 rounded-b-none border-b-0" : "border-hair2"
              }`}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${applyToGroup ? "bg-amber" : "border border-[#3A3F46]"}`}>
                {applyToGroup && <Check size={13} color="#14161A" />}
              </div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Link2 size={13} className="text-amber" /> Uplatnit i na stejnou skupinu
              </div>
            </button>

            {applyToGroup && (
              <div className="border border-t-0 border-amber/40 rounded-b-xl px-4 py-3 space-y-2">
                <div className="text-xs text-secondary mb-1">Odškrtněte, co se má vynechat:</div>
                {siblings.map((s) => {
                  const checked = !excluded.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSibling(s.id)}
                      className="w-full flex items-center gap-2.5 text-left"
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${checked ? "bg-amber" : "border border-[#3A3F46]"}`}>
                        {checked && <Check size={11} color="#14161A" />}
                      </div>
                      <span className={`text-sm ${checked ? "text-strong" : "text-faint line-through"}`}>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          onClick={savePrice}
          disabled={!valid || saving}
          className="w-full rounded-xl py-3.5 font-semibold transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: valid ? "#FFB020" : "#3A3F46", color: "#14161A" }}
        >
          {saving && <Loader2 size={16} className="spin" />}
          {unpriced ? "Zalistovat s touto cenou" : applyToGroup && hasGroup ? `Uložit cenu pro ${includedSiblings.length + 1} položky` : "Uložit cenu"}
        </button>

        {!unpriced && (
          <button
            onClick={markMissing}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 mt-2.5 font-medium text-red border border-redSoft active:scale-[0.98] transition disabled:opacity-50"
          >
            <PackageX size={16} /> Není na regálu
          </button>
        )}
      </div>
    </div>
  );
}
