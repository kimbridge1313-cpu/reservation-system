import React, { useEffect, useMemo, useState } from "react";

/**
 * 預約系統前端｜Vercel 部署版
 *
 * 設定：
 * 1. LIFF_ID：LINE Developers 後台建立的 LIFF ID
 * 2. GAS_API_URL：Google Apps Script 部署後的 Web App URL
 * 3. OWNER_LINE_USER_ID：老闆的 LINE User ID
 *
 * 注意：
 * - Canvas / localhost / 非 LINE 環境會進入預覽模式，不呼叫 GAS。
 * - 正式部署到 Vercel 並從 LINE LIFF 開啟時，才會呼叫 GAS。
 * - 這版不依賴 shadcn 或 framer-motion，適合直接部署到 Vercel。
 */
const CONFIG = {
  LIFF_ID: "2009890246-ux50hZvN",
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbytk_rcqikqxandcITgWupT0XVUDsQfzJarZpyrDw1FbiF2bIy1XfbLGrior999GMSb/exec",
  OWNER_LINE_USER_ID: "U0d01ce43203dbcf0d3a94436b60eb232",
};

const PROJECT_OPTIONS = [
  "走讀成龍",
  "守護溼地",
  "簡報交流",
  "魚拓畫創作",
  "成龍摸蛤趣",
  "荒草重生",
  "冬季三合院餐桌",
  "夏季溼地餐桌",
];

const initialForm = {
  group_name: "",
  people_count: "",
  visit_datetime: "",
  duration: "",
  project_items: [],
  purpose: "",
  contact_name: "",
  contact_phone: "",
  note: "",
};

function isAppConfigured(config = CONFIG) {
  return Boolean(
    config.LIFF_ID &&
      config.GAS_API_URL &&
      !config.LIFF_ID.includes("請填入") &&
      !config.GAS_API_URL.includes("請填入")
  );
}

function isPreviewEnvironment() {
  if (typeof window === "undefined") return false;

  const host = window.location.hostname || "";
  const href = window.location.href || "";

  return (
    window.self !== window.top ||
    host.includes("chatgpt") ||
    host.includes("openai") ||
    host.includes("sandbox") ||
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    href.includes("preview")
  );
}

function isLineClient() {
  if (typeof navigator === "undefined") return false;
  return /Line/i.test(navigator.userAgent || "");
}

function shouldUsePreviewMode() {
  // 只有 Canvas、localhost、sandbox 才進預覽模式。
  // Vercel 正式網址即使不是在 LINE App 裡開，也應該進入正式流程，讓 LIFF login / GAS API 可以運作。
  return isPreviewEnvironment();
}

function canUseRealApi(previewMode, configured) {
  return configured && !previewMode;
}

function isOwnerUser(lineUserId, config = CONFIG) {
  return Boolean(lineUserId && config.OWNER_LINE_USER_ID && lineUserId === config.OWNER_LINE_USER_ID);
}

function validateReservationForm(form, lineUserId, configured, previewMode) {
  if (!lineUserId && configured && !previewMode) return "尚未取得 LINE User ID，請從 LINE LIFF 頁面開啟。";
  if (!form.group_name.trim()) return "請填寫來訪團體名稱。";
  if (!form.people_count) return "請填寫預計參訪人數。";
  if (Number(form.people_count) <= 0) return "預計參訪人數需大於 0。";
  if (!form.visit_datetime) return "請選擇預計參訪時間。";
  if (!form.duration.trim()) return "請填寫預計停留時間長度。";
  if (!Array.isArray(form.project_items) || form.project_items.length === 0) return "請至少選擇一個預約項目。";
  if (!form.purpose.trim()) return "請填寫需求及目的。";
  if (!form.contact_name.trim()) return "請填寫負責聯絡人。";
  if (!form.contact_phone.trim()) return "請填寫負責聯絡人電話。";
  return "";
}

function formatProjectItems(value) {
  if (Array.isArray(value)) return value.join("、");
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.join("、") : value;
  } catch {
    return value || "未填寫";
  }
}

function createMockReservationNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 999)).padStart(3, "0");
  return `PREVIEW-${yyyy}${mm}${dd}-${random}`;
}

function createLocalRecord(form, reservationNo, lineUserId, status = "本地預覽") {
  return {
    id: `LOCAL-${Date.now()}`,
    reservation_no: reservationNo,
    line_user_id: lineUserId || "MOCK_LINE_USER_ID",
    group_name: form.group_name,
    people_count: form.people_count,
    visit_datetime: form.visit_datetime,
    duration: form.duration,
    project_items: JSON.stringify(form.project_items || []),
    purpose: form.purpose,
    contact_name: form.contact_name,
    contact_phone: form.contact_phone,
    note: form.note || "",
    status,
    created_at: new Date().toISOString(),
  };
}

function createSampleRecords(ownerLineUserId) {
  return [
    {
      id: "SAMPLE-001",
      reservation_no: "RES-20260429-001",
      line_user_id: ownerLineUserId || "MOCK_OWNER_LINE_USER_ID",
      group_name: "預覽團體 A",
      people_count: "20",
      visit_datetime: "2026-05-01T10:00",
      duration: "2小時",
      project_items: '["走讀成龍","魚拓畫創作"]',
      purpose: "環境教育參訪與地方創生交流",
      contact_name: "預覽聯絡人",
      contact_phone: "0912345678",
      note: "這是一筆本地預覽資料，不會寫入 Google Sheet。",
      status: "預覽資料",
      created_at: "2026-04-29T10:00:00+08:00",
    },
    {
      id: "SAMPLE-002",
      reservation_no: "RES-20260429-002",
      line_user_id: "CUSTOMER_SAMPLE_USER_ID",
      group_name: "預覽團體 B",
      people_count: "12",
      visit_datetime: "2026-05-03T14:00",
      duration: "半天",
      project_items: '["守護溼地","簡報交流"]',
      purpose: "濕地議題課程體驗",
      contact_name: "林小美",
      contact_phone: "0987654321",
      note: "希望安排室內簡報。",
      status: "已送出",
      created_at: "2026-04-29T11:00:00+08:00",
    },
  ];
}

function getApiErrorText(error, operation) {
  const raw = error && error.message ? error.message : String(error || "Unknown error");

  if (raw.includes("Failed to fetch")) {
    return `${operation}失敗：目前瀏覽器連不到 GAS API。請用 Vercel 正式網址或 LINE LIFF 測試，並確認 GAS Web App 權限為「所有人」。`;
  }

  return `${operation}失敗：${raw}`;
}

async function fetchJsonSafely(url, options = {}, operation = "API 請求") {
  try {
    const response = await fetch(url, options);
    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        error: `${operation}失敗：HTTP ${response.status} ${response.statusText || ""}`.trim(),
      };
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: `${operation}失敗：GAS 回傳不是 JSON。請確認 doGet/doPost 使用 jsonResponse 回傳。`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: getApiErrorText(error, operation),
    };
  }
}

function buildGasGetUrl(action, lineUserId) {
  const params = new URLSearchParams({
    action,
    line_user_id: lineUserId || "",
  });

  return `${CONFIG.GAS_API_URL}?${params.toString()}`;
}

function runSelfTests() {
  const completeForm = {
    ...initialForm,
    group_name: "測試團體",
    people_count: "12",
    visit_datetime: "2026-05-01T10:00",
    duration: "2小時",
    project_items: ["走讀成龍"],
    purpose: "環境教育參訪",
    contact_name: "王小明",
    contact_phone: "0912345678",
  };

  const localRecord = createLocalRecord(completeForm, "PREVIEW-20260429-001", "U123", "本地預覽");
  const samples = createSampleRecords("OWNER");

  const tests = [
    { name: "format array project items", pass: formatProjectItems(["走讀成龍", "魚拓畫創作"]) === "走讀成龍、魚拓畫創作" },
    { name: "format JSON string project items", pass: formatProjectItems('["守護溼地","簡報交流"]') === "守護溼地、簡報交流" },
    { name: "reject empty group name", pass: validateReservationForm({ ...initialForm }, "U123", true, false) === "請填寫來訪團體名稱。" },
    { name: "accept complete reservation form in real mode", pass: validateReservationForm(completeForm, "U123", true, false) === "" },
    { name: "accept complete reservation form in preview mode without line user id", pass: validateReservationForm(completeForm, "", true, true) === "" },
    { name: "real API is disabled in preview mode", pass: canUseRealApi(true, true) === false },
    { name: "real API is enabled only when configured and not preview", pass: canUseRealApi(false, true) === true },
    { name: "owner user is detected", pass: isOwnerUser("OWNER", { OWNER_LINE_USER_ID: "OWNER" }) === true },
    { name: "non-owner user is rejected", pass: isOwnerUser("CUSTOMER", { OWNER_LINE_USER_ID: "OWNER" }) === false },
    { name: "local record keeps contact phone", pass: localRecord.contact_phone === "0912345678" },
    { name: "build GAS get URL includes action", pass: buildGasGetUrl("getAllReservations", "U123").includes("action=getAllReservations") },
    { name: "fetch failure message explains GAS access issue", pass: getApiErrorText(new TypeError("Failed to fetch"), "查詢訂單").includes("GAS API") },
    { name: "sample records contain two orders", pass: samples.length === 2 },
  ];

  const failed = tests.filter((test) => !test.pass);
  if (failed.length > 0) {
    console.info("Self tests failed:", failed.map((test) => test.name));
  } else {
    console.info("Self tests passed:", tests.length);
  }
}

if (typeof window !== "undefined") {
  runSelfTests();
}

export default function LiffReservationForm() {
  const [liffReady, setLiffReady] = useState(false);
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [successReservationNo, setSuccessReservationNo] = useState("");
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState("form");

  const isConfigured = useMemo(() => isAppConfigured(CONFIG), []);
  const previewMode = useMemo(() => shouldUsePreviewMode(), []);
  const realApiEnabled = useMemo(() => canUseRealApi(previewMode, isConfigured), [previewMode, isConfigured]);
  const isOwner = useMemo(() => isOwnerUser(lineUserId, CONFIG), [lineUserId]);

  useEffect(() => {
    async function initLiff() {
      if (previewMode) {
        setLineUserId(CONFIG.OWNER_LINE_USER_ID || "MOCK_OWNER_LINE_USER_ID");
        setDisplayName("預覽老闆");
        setMessage("目前是預覽模式：不會呼叫 LIFF，也不會呼叫 GAS。正式寫入請用 Vercel/LINE LIFF 測。 ");
        setMessageType("info");
        setRecords(createSampleRecords(CONFIG.OWNER_LINE_USER_ID));
        setLiffReady(true);
        return;
      }

      if (!isConfigured) {
        setMessage("請先設定 LIFF_ID 與 GAS_API_URL。正式測試需要填入設定。");
        setMessageType("warning");
        setLiffReady(true);
        return;
      }

      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;

        await liff.init({ liffId: CONFIG.LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
        setDisplayName(profile.displayName || "");
        setMessage("LINE 身分已取得，可以正式送出預約。 ");
        setMessageType("success");
        setLiffReady(true);
      } catch (error) {
        setMessage("LIFF 初始化失敗：請確認 LIFF ID、Endpoint URL 與 LINE Developers 設定。 ");
        setMessageType("warning");
        setLiffReady(true);
      }
    }

    initLiff();
  }, [isConfigured, previewMode]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleProject(item) {
    setForm((prev) => {
      const exists = prev.project_items.includes(item);
      return {
        ...prev,
        project_items: exists ? prev.project_items.filter((x) => x !== item) : [...prev.project_items, item],
      };
    });
  }

  async function submitReservation(e) {
    e.preventDefault();
    setMessage("");
    setSuccessReservationNo("");

    const error = validateReservationForm(form, lineUserId, isConfigured, previewMode);
    if (error) {
      setMessage(error);
      setMessageType("warning");
      return;
    }

    const localNo = createMockReservationNo();
    const localRecord = createLocalRecord(form, localNo, lineUserId, previewMode ? "預覽送出" : "本地暫存");

    if (!realApiEnabled) {
      setSuccessReservationNo(localNo);
      setRecords((prev) => [localRecord, ...prev]);
      setMessage(previewMode ? "預覽送出成功：這筆資料只存在畫面中，不會寫入 Google Sheets。正式寫入請用 Vercel/LINE LIFF 開啟。" : "目前 API 尚未設定完成，因此只建立本地暫存資料。 ");
      setMessageType("success");
      setForm(initialForm);
      return;
    }

    setLoading(true);

    const payload = {
      action: "createReservation",
      line_user_id: lineUserId,
      ...form,
    };

    const result = await fetchJsonSafely(
      CONFIG.GAS_API_URL,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      },
      "送出預約"
    );

    if (!result.ok) {
      setSuccessReservationNo(localNo);
      setRecords((prev) => [localRecord, ...prev]);
      setMessage(`${result.error || result.message || "送出失敗"} 已先保留本地暫存資料。`);
      setMessageType("warning");
      setLoading(false);
      return;
    }

    const reservationNo = result.reservation_no || localNo;
    setSuccessReservationNo(reservationNo);
    setRecords((prev) => [
      { ...localRecord, reservation_no: reservationNo, status: result.status || "已送出" },
      ...prev,
    ]);
    setMessage("預約已成功送出，我們會盡快與您確認。LINE 也會收到預約通知。");
    setMessageType("success");
    setForm(initialForm);
    setLoading(false);
  }

  async function fetchRecords() {
    setMessage("");

    if (!lineUserId && isConfigured && !previewMode) {
      setMessage("尚未取得 LINE User ID，無法查詢預約紀錄。請從 LINE LIFF 頁面開啟。");
      setMessageType("warning");
      return;
    }

    if (!realApiEnabled) {
      setRecords((prev) => (prev.length > 0 ? prev : createSampleRecords(CONFIG.OWNER_LINE_USER_ID)));
      setMessage(previewMode ? "目前顯示預覽資料，沒有呼叫 GAS。" : "目前 API 尚未設定完成，顯示本地預覽資料。");
      setMessageType("info");
      return;
    }

    setQueryLoading(true);

    const action = isOwner ? "getAllReservations" : "getUserReservations";
    const url = buildGasGetUrl(action, lineUserId);
    const result = await fetchJsonSafely(url, { method: "GET" }, "查詢訂單");

    if (!result.ok) {
      setMessage(`${result.error || result.message || "查詢失敗"} 若你剛修改 GAS，請確認已「新增版本」並重新部署。`);
      setMessageType("warning");
      setQueryLoading(false);
      return;
    }

    setRecords(result.records || []);
    setMessage(isOwner ? "老闆模式：已載入全部預約訂單。" : "已載入您的預約紀錄。");
    setMessageType("success");
    setQueryLoading(false);
  }

  if (!liffReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-stone-700">
          <SpinnerIcon className="h-5 w-5 animate-spin" />
          正在初始化預約系統...
        </div>
      </div>
    );
  }

  const messageClass = messageType === "success"
    ? "border-green-200 bg-green-50 text-green-800"
    : messageType === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-stone-200 bg-white text-stone-700";

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 text-stone-900">
      <div className="mx-auto max-w-3xl animate-fade-in">
        <header className="mb-5 rounded-3xl bg-white p-6 shadow-sm border border-stone-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-stone-500">社區活動工作室</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">活動參訪預約</h1>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                請填寫預約資料。送出後，系統會自動通知工作室，並透過 LINE 傳送預約明細給您。
              </p>
            </div>
            <div className="rounded-2xl bg-stone-100 p-3 text-2xl" aria-hidden="true">📅</div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
            <span aria-hidden="true">👤</span>
            <span>{displayName ? `LINE 使用者：${displayName}` : isConfigured ? "已啟用 LINE 身分綁定" : "預覽模式：尚未連接 LIFF"}</span>
            {isOwner && <span className="rounded-full bg-stone-900 px-2 py-0.5 text-xs text-white">老闆模式</span>}
            {previewMode && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-stone-500">Preview</span>}
            {!realApiEnabled && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-stone-500">不呼叫 GAS</span>}
          </div>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow-sm border border-stone-200">
          <Button variant={activeTab === "form" ? "default" : "ghost"} className="rounded-xl" onClick={() => setActiveTab("form")}>填寫預約</Button>
          <Button variant={activeTab === "records" ? "default" : "ghost"} className="rounded-xl" onClick={() => { setActiveTab("records"); fetchRecords(); }}>{isOwner ? "全部訂單" : "查詢紀錄"}</Button>
        </div>

        {message && (
          <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${messageClass}`}>
            {successReservationNo && <div className="mb-1 flex items-center gap-2 font-semibold"><span aria-hidden="true">✅</span>預約編號：{successReservationNo}</div>}
            {message}
          </div>
        )}

        {activeTab === "form" && (
          <Card>
            <CardContent>
              <form onSubmit={submitReservation} className="space-y-5">
                <Field label="來訪團體名稱" required>
                  <input className="input" value={form.group_name} onChange={(e) => updateField("group_name", e.target.value)} placeholder="例如：成龍社區參訪團" />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="預計參訪人數" required>
                    <input className="input" type="number" min="1" value={form.people_count} onChange={(e) => updateField("people_count", e.target.value)} placeholder="例如：20" />
                  </Field>
                  <Field label="預計停留時間長度" required>
                    <input className="input" value={form.duration} onChange={(e) => updateField("duration", e.target.value)} placeholder="例如：2小時 / 半天 / 一日" />
                  </Field>
                </div>

                <Field label="預計參訪時間" required>
                  <input className="input" type="datetime-local" value={form.visit_datetime} onChange={(e) => updateField("visit_datetime", e.target.value)} />
                </Field>

                <Field label="預約項目" required>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PROJECT_OPTIONS.map((item) => {
                      const selected = form.project_items.includes(item);
                      return (
                        <button key={item} type="button" onClick={() => toggleProject(item)} className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${selected ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"}`}>
                          {selected ? "✓ " : ""}{item}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="需求及目的" required>
                  <textarea className="input min-h-28 resize-none" value={form.purpose} onChange={(e) => updateField("purpose", e.target.value)} placeholder="請簡述這次參訪目的、期待內容或團體需求" />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="負責聯絡人" required>
                    <input className="input" value={form.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} placeholder="姓名" />
                  </Field>
                  <Field label="負責聯絡人電話" required>
                    <input className="input" value={form.contact_phone} onChange={(e) => updateField("contact_phone", e.target.value)} placeholder="手機或市話" />
                  </Field>
                </div>

                <Field label="其他問題">
                  <textarea className="input min-h-24 resize-none" value={form.note} onChange={(e) => updateField("note", e.target.value)} placeholder="交通、餐食、特殊需求或其他想詢問的問題" />
                </Field>

                <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl text-base">
                  {loading ? <span className="inline-flex items-center gap-2"><SpinnerIcon className="h-4 w-4 animate-spin" />送出中...</span> : <span className="inline-flex items-center gap-2"><span aria-hidden="true">📨</span>{realApiEnabled ? "送出預約" : "預覽送出"}</span>}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === "records" && (
          <Card>
            <CardContent>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{isOwner ? "全部預約訂單" : "我的預約紀錄"}</h2>
                  <p className="mt-1 text-sm text-stone-500">{isOwner ? "老闆模式會顯示全部預約。預覽中為假資料；正式 LIFF 中會讀取 Google Sheets。" : "依 LINE User ID 查詢您送出的預約。"}</p>
                </div>
                <Button variant="outline" className="rounded-xl" onClick={fetchRecords} disabled={queryLoading}>{queryLoading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : "重新整理"}</Button>
              </div>

              {records.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">目前查無預約紀錄。</div>
              ) : (
                <div className="space-y-3">
                  {records.map((record, index) => (
                    <div key={`${record.reservation_no || "NO"}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-semibold"><span aria-hidden="true">📋</span>{record.reservation_no || "未產生編號"}</div>
                          <p className="mt-1 text-sm text-stone-500">{record.group_name || "未填寫團體名稱"}</p>
                        </div>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">{record.status || "未填寫"}</span>
                      </div>
                      <div className="grid gap-2 text-sm text-stone-700">
                        <p>參訪時間：{record.visit_datetime || "未填寫"}</p>
                        <p>參訪人數：{record.people_count || "未填寫"}</p>
                        <p>停留時間：{record.duration || "未填寫"}</p>
                        <p>預約項目：{formatProjectItems(record.project_items)}</p>
                        {isOwner && <p>聯絡人：{record.contact_name || "未填寫"} / {record.contact_phone || "未填寫"}</p>}
                        {isOwner && <p>需求目的：{record.purpose || "未填寫"}</p>}
                        {isOwner && record.note && <p>其他問題：{record.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isOwner && <div className="mt-5 rounded-2xl bg-stone-100 p-4 text-xs leading-6 text-stone-600">正式查詢全部訂單需要：GAS 已加入 getAllReservations、部署為新版本、Web App 權限為所有人，且從 Vercel/LINE LIFF 開啟。</div>}
            </CardContent>
          </Card>
        )}
      </div>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.25s ease-out both; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border-radius: 0.75rem; padding: 0.625rem 1rem; font-size: 0.875rem; font-weight: 500; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; border: 1px solid transparent; cursor: pointer; user-select: none; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-default { background: rgb(28 25 23); color: white; }
        .btn-default:hover:not(:disabled) { background: rgb(68 64 60); }
        .btn-ghost { background: transparent; color: rgb(68 64 60); }
        .btn-ghost:hover:not(:disabled) { background: rgb(245 245 244); }
        .btn-outline { background: white; color: rgb(68 64 60); border-color: rgb(214 211 209); }
        .btn-outline:hover:not(:disabled) { background: rgb(250 250 249); }
        .card { border-radius: 1.5rem; border: 1px solid rgb(231 229 228); background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .card-content { padding: 1.25rem; }
        @media (min-width: 768px) { .card-content { padding: 1.5rem; } }
        .input { width: 100%; border-radius: 1rem; border: 1px solid rgb(231 229 228); background: white; padding: 0.85rem 1rem; font-size: 0.95rem; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        .input:focus { border-color: rgb(41 37 36); box-shadow: 0 0 0 3px rgba(41, 37, 36, 0.08); }
      `}</style>
    </div>
  );
}

function Button({ children, type = "button", variant = "default", className = "", disabled = false, onClick }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant} ${className}`}>{children}</button>;
}

function Card({ children }) {
  return <div className="card">{children}</div>;
}

function CardContent({ children }) {
  return <div className="card-content">{children}</div>;
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-stone-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </div>
      {children}
    </label>
  );
}

function SpinnerIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
