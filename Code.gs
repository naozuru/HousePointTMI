/**
 * TMI House Points - Google Apps Script Backend v2.0
 * Tunas Mekar Indonesia - Digital Student Points System
 *
 * Sheet structures:
 *   Teachers:     [id, username, password, nfc_id, name]
 *   Students:     [nis, nfc_id, name, class, house, photo_url, points]
 *   Violations:   [id, name, type(plus|minus), point, category]
 *   Transactions: [tr_id, timestamp, teacher_id, student_nis, violation_id, point_change, note, deleted(0|1), deleted_by, deleted_at, class, house]
 *   AuditLog:     [log_id, timestamp, actor, action, target, details]
 *   Announcements:[id, title, body, created_at, expires_at, active]
 */

// =====================================================================
// CONFIGURATION
// =====================================================================

const SPREADSHEET_ID = "1LlguT3Lo38QrPoLTNS8xQ8cFV2_8vN2ysLXBb01JtS8";
const SHEET_TEACHERS = "Teachers";
const SHEET_STUDENTS = "Students";
const SHEET_VIOLATIONS = "Violations";
const SHEET_TRANSACTIONS = "Transactions";
const SHEET_AUDIT = "AuditLog";
const SHEET_ANNOUNCEMENTS = "Announcements";

const HOUSES = ["JJT", "Jensud", "Munir"];
const HOUSE_COLORS = {
  JJT: "#004632",
  Jensud: "#00835c",
  Munir: "#2ea876"
};

// Configuration validation - fail fast with a clear error if the spreadsheet
// ID has not been replaced from the placeholder.
const SPREADSHEET_ID_PLACEHOLDER = "MASUKKAN_SPREADSHEET_ID_DISINI";
const SPREADSHEET_ID_MISSING_MSG =
  "Spreadsheet ID is not configured. Open Code.gs and replace SPREADSHEET_ID " +
  "with the ID of your Google Sheet (the long segment between /d/ and /edit in the URL), " +
  "then redeploy this script.";

function assertSpreadsheetIdConfigured() {
  if (!SPREADSHEET_ID ||
      SPREADSHEET_ID === SPREADSHEET_ID_PLACEHOLDER ||
      SPREADSHEET_ID.indexOf("MASUKKAN") === 0) {
    throw new Error(SPREADSHEET_ID_MISSING_MSG);
  }
}

let _ssCache = null;
function getSS() {
  assertSpreadsheetIdConfigured();
  if (!_ssCache) {
    try {
      _ssCache = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      _ssCache = null;
      throw new Error(
        "Could not open spreadsheet. Verify that SPREADSHEET_ID is correct " +
        "and that this script has been granted access to the sheet. (" + e.message + ")"
      );
    }
  }
  return _ssCache;
}

function getSheet(name) {
  const sheet = getSS().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found`);
  return sheet;
}

// =====================================================================
// ENTRY POINTS
// =====================================================================

function doGet(e) {
  const isPlaceholder =
    !SPREADSHEET_ID ||
    SPREADSHEET_ID === SPREADSHEET_ID_PLACEHOLDER ||
    SPREADSHEET_ID.indexOf("MASUKKAN") === 0;
  const configured = !isPlaceholder;
  return ContentService.createTextOutput(
    JSON.stringify({
      status: configured ? "ok" : "config_error",
      version: "2.1",
      spreadsheetConfigured: configured,
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result = {};

    switch (action) {
      // Auth
      case "login": result = handleLogin(data); break;
      case "parentLogin": result = handleParentLogin(data.nis); break;

      // Students
      case "getStudents": result = handleGetStudents(data); break;
      case "getStudentHistory": result = handleGetStudentHistory(data); break;
      case "getStudentStats": result = handleGetStudentStats(data); break;

      // Violations
      case "getViolations": result = handleGetViolations(data); break;

      // Transactions
      case "addTransaction": result = handleAddTransaction(data); break;
      case "undoTransaction": result = handleUndoTransaction(data); break;
      case "redoTransaction": result = handleRedoTransaction(data); break;
      case "deleteTransaction": result = handleDeleteTransaction(data); break;
      case "getTransaction": result = handleGetTransaction(data); break;

      // Reports
      case "getLeaderboard": result = handleGetLeaderboard(data); break;
      case "getHistory": result = handleGetHistory(data); break;
      case "getHousePoints": result = handleGetHousePoints(); break;
      case "getHouseHistory": result = handleGetHouseHistory(data); break;
      case "getDashboardStats": result = handleGetDashboardStats(); break;
      case "getClassStats": result = handleGetClassStats(); break;
      case "getActivityHeatmap": result = handleGetActivityHeatmap(data); break;

      // Audit & Announcements
      case "getAuditLog": result = handleGetAuditLog(data); break;
      case "getAnnouncements": result = handleGetAnnouncements(); break;

      // Export
      case "exportData": result = handleExportData(data); break;
      case "getStudentsReport": result = handleGetStudentsReport(data); break;

      default:
        result = { status: "error", message: `Unknown action "${action}"` };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // Detect the common "spreadsheet id not configured" case and return a
    // friendlier, structured error so the frontend can display it cleanly.
    const rawMessage = (err && err.message) ? err.message.toString() : String(err);
    let code = "server_error";
    let message = rawMessage;
    if (rawMessage.indexOf("MASUKKAN") !== -1 ||
        rawMessage.indexOf("not configured") !== -1 ||
        rawMessage.indexOf("Illegal spreadsheet") !== -1 ||
        rawMessage.indexOf("Could not open spreadsheet") !== -1) {
      code = "spreadsheet_not_configured";
      message = SPREADSHEET_ID_MISSING_MSG;
    }
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", code: code, message: message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// =====================================================================
// AUDIT LOG
// =====================================================================

function writeAudit(actor, action, target, details) {
  try {
    const sheet = getSheet(SHEET_AUDIT);
    const logId = `LOG${Date.now()}${Math.floor(Math.random() * 1000)}`;
    sheet.appendRow([
      logId,
      new Date(),
      actor || "system",
      action,
      target || "",
      details || ""
    ]);
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}

// =====================================================================
// AUTH
// =====================================================================

function handleLogin(data) {
  if (!data.username && !data.nfc_id) {
    return { status: "error", message: "Username or NFC ID is required" };
  }

  const sheet = getSheet(SHEET_TEACHERS);
  const values = sheet.getDataRange().getValues();
  values.shift();

  for (let row of values) {
    const [id, username, password, nfc_id, name] = row;
    // Normalize to strings so numeric cells (e.g. password "123" stored as number) still match
    if (data.username
        && String(data.username).trim() === String(username).trim()
        && String(data.password) === String(password)) {
      writeAudit(id, "login", id, `Login via username: ${username}`);
      return { status: "success", teacher: { id, name, username } };
    }
    if (data.nfc_id
        && String(data.nfc_id).trim().toUpperCase() === String(nfc_id).trim().toUpperCase()) {
      writeAudit(id, "login", id, `Login via NFC: ${data.nfc_id}`);
      return { status: "success", teacher: { id, name, username } };
    }
  }
  return { status: "error", message: "Wrong username/password or unregistered card" };
}

function handleParentLogin(nis) {
  if (!nis) return { status: "error", message: "NIS is required" };

  const sSheet = getSheet(SHEET_STUDENTS);
  const sValues = sSheet.getDataRange().getValues();
  let student = null;
  let studentRow = -1;

  for (let i = 1; i < sValues.length; i++) {
    if (String(sValues[i][0]) === String(nis)) {
      student = {
        nis: sValues[i][0],
        nfc_id: sValues[i][1],
        name: sValues[i][2],
        class: sValues[i][3],
        house: sValues[i][4],
        photo_url: sanitizePhotoUrl(sValues[i][5]),
        points: parseInt(sValues[i][6]) || 0
      };
      studentRow = i + 1;
      break;
    }
  }

  if (!student) return { status: "error", message: "NIS not found" };

  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();
  const history = tValues
    .filter((t) => String(t[3]) === String(nis) && t[7] !== 1) // exclude soft-deleted
    .map((t) => ({
      tr_id: t[0],
      date: new Date(t[1]),
      points: parseInt(t[5]) || 0,
      note: t[6] || "",
      violation_name: getViolationName(t[4])
    }))
    .reverse();

  const stats = computeStudentStats(history);

  writeAudit("parent", "parentLogin", String(nis), `Parent login NIS: ${nis}`);
  return { status: "success", student, history, stats };
}

function getViolationName(violationId) {
  try {
    const sheet = getSheet(SHEET_VIOLATIONS);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(violationId)) return values[i][1];
    }
  } catch (e) { }
  return "Unknown";
}

function computeStudentStats(history) {
  const total = history.length;
  let positive = 0, negative = 0, totalPos = 0, totalNeg = 0;
  history.forEach(t => {
    if (t.points > 0) { positive++; totalPos += t.points; }
    else { negative++; totalNeg += Math.abs(t.points); }
  });
  return {
    total_transactions: total,
    positive_count: positive,
    negative_count: negative,
    total_positive: totalPos,
    total_negative: totalNeg
  };
}

// =====================================================================
// STUDENTS
// =====================================================================

function handleGetStudents(data) {
  const sheet = getSheet(SHEET_STUDENTS);
  const values = sheet.getDataRange().getValues();
  values.shift();
  let students = values.map((row) => ({
    nis: row[0],
    nfc_id: row[1] || "",
    name: row[2],
    class: row[3],
    house: row[4],
    photo_url: sanitizePhotoUrl(row[5]),
    points: parseInt(row[6]) || 0
  }));

  if (data && data.house) {
    students = students.filter(s => s.house === data.house);
  }
  if (data && data.grade) {
    students = students.filter(s => String(s.class) === String(data.grade));
  }

  return { status: "success", students, total: students.length };
}

function sanitizePhotoUrl(url) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return "";
  return url;
}

function handleGetStudentHistory(data) {
  if (!data || !data.nis) return { status: "error", message: "NIS is required" };
  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  let limit = parseInt(data.limit) || 50;
  let history = tValues
    .filter((t) => String(t[3]) === String(data.nis) && t[7] !== 1)
    .map((t) => ({
      tr_id: t[0],
      date: new Date(t[1]),
      points: parseInt(t[5]) || 0,
      note: t[6] || "",
      teacher_id: t[2],
      violation_id: t[4],
      violation_name: getViolationName(t[4])
    }))
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);

  return { status: "success", history };
}

function handleGetStudentStats(data) {
  if (!data || !data.nis) return { status: "error", message: "NIS is required" };
  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  const filtered = tValues.filter(t => String(t[3]) === String(data.nis) && t[7] !== 1);
  const stats = computeStudentStats(filtered.map(t => ({
    points: parseInt(t[5]) || 0
  })));

  return { status: "success", stats };
}

// =====================================================================
// VIOLATIONS
// =====================================================================

function handleGetViolations(data) {
  const sheet = getSheet(SHEET_VIOLATIONS);
  const values = sheet.getDataRange().getValues();
  values.shift();
  let violations = values.map((row) => ({
    id: row[0],
    name: row[1],
    type: (row[2] || "").toString().trim().toLowerCase(),
    point: parseInt(row[3]) || 0,
    category: row[4] || "General"
  }));

  if (data && data.type && data.type !== "all") {
    violations = violations.filter(v => v.type === data.type);
  }
  if (data && data.category) {
    violations = violations.filter(v => v.category === data.category);
  }

  const categories = [...new Set(violations.map(v => v.category))];
  return { status: "success", violations, categories };
}

// =====================================================================
// TRANSACTIONS
// =====================================================================

function handleAddTransaction(data) {
  // Validation
  if (!data.teacher_id) return { status: "error", message: "teacher_id is required" };
  if (!data.student_nis) return { status: "error", message: "student_nis is required" };
  if (!data.violation_id) return { status: "error", message: "violation_id is required" };
  if (isNaN(parseInt(data.point_change))) return { status: "error", message: "point_change is invalid" };

  const pointChange = parseInt(data.point_change);

  const sSheet = getSheet(SHEET_STUDENTS);
  const sValues = sSheet.getDataRange().getValues();
  let studentRowIndex = -1;
  let currentPoints = 0;
  let studentClass = "";
  let studentHouse = "";
  let studentName = "";

  for (let i = 1; i < sValues.length; i++) {
    if (String(sValues[i][0]) === String(data.student_nis)) {
      studentRowIndex = i + 1;
      currentPoints = parseInt(sValues[i][6]) || 0;
      studentClass = sValues[i][3];
      studentHouse = sValues[i][4];
      studentName = sValues[i][2];
      break;
    }
  }

  if (studentRowIndex === -1) {
    return { status: "error", message: "Student not found" };
  }

  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const trId = `TR${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const timestamp = new Date();
  const note = (data.note || "").toString().slice(0, 500);

  tSheet.appendRow([
    trId,
    timestamp,
    String(data.teacher_id),
    String(data.student_nis),
    String(data.violation_id),
    pointChange,
    note,
    0, // deleted
    "",
    "",
    studentClass,
    studentHouse
  ]);

  const newPoints = currentPoints + pointChange;
  sSheet.getRange(studentRowIndex, 7).setValue(newPoints);

  // Check milestones
  const milestone = checkMilestone(newPoints);

  writeAudit(
    String(data.teacher_id),
    "addTransaction",
    trId,
    `${pointChange >= 0 ? '+' : ''}${pointChange} points to ${studentName} (${studentClass}) - ${note}`
  );

  return {
    status: "success",
    newPoints,
    tr_id: trId,
    milestone
  };
}

function checkMilestone(points) {
  const milestones = [100, 50, 25, 10, -10, -25, -50, -100];
  for (const m of milestones) {
    if ((m > 0 && points === m) || (m < 0 && points === m)) {
      return { type: m > 0 ? "achievement" : "warning", value: m };
    }
  }
  return null;
}

function handleUndoTransaction(data) {
  if (!data || !data.tr_id) return { status: "error", message: "tr_id is required" };

  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const tValues = tSheet.getDataRange().getValues();

  let trRowIndex = -1;
  let studentNis = 0;
  let pointChange = 0;
  let deleted = 0;

  for (let i = 1; i < tValues.length; i++) {
    if (tValues[i][0] === data.tr_id) {
      trRowIndex = i + 1;
      studentNis = tValues[i][3];
      pointChange = parseInt(tValues[i][5]) || 0;
      deleted = tValues[i][7];
      break;
    }
  }

  if (trRowIndex === -1) return { status: "error", message: "Transaction not found" };
  if (deleted === 1) return { status: "error", message: "Transaction is already deleted" };

  // Soft-delete
  tSheet.getRange(trRowIndex, 8).setValue(1);
  tSheet.getRange(trRowIndex, 9).setValue(data.actor || "system");
  tSheet.getRange(trRowIndex, 10).setValue(new Date());

  // Revert points
  const sSheet = getSheet(SHEET_STUDENTS);
  const sValues = sSheet.getDataRange().getValues();
  for (let i = 1; i < sValues.length; i++) {
    if (String(sValues[i][0]) === String(studentNis)) {
      const currentPoints = parseInt(sValues[i][6]) || 0;
      sSheet.getRange(i + 1, 7).setValue(currentPoints - pointChange);
      break;
    }
  }

  writeAudit(
    data.actor || "system",
    "undoTransaction",
    data.tr_id,
    `Undo ${pointChange} points from NIS ${studentNis}`
  );

  return { status: "success", tr_id: data.tr_id };
}

function handleRedoTransaction(data) {
  if (!data || !data.tr_id) return { status: "error", message: "tr_id is required" };

  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const tValues = tSheet.getDataRange().getValues();

  let trRowIndex = -1;
  let studentNis = 0;
  let pointChange = 0;
  let deleted = 0;

  for (let i = 1; i < tValues.length; i++) {
    if (tValues[i][0] === data.tr_id) {
      trRowIndex = i + 1;
      studentNis = tValues[i][3];
      pointChange = parseInt(tValues[i][5]) || 0;
      deleted = tValues[i][7];
      break;
    }
  }

  if (trRowIndex === -1) return { status: "error", message: "Transaction not found" };
  if (deleted !== 1) return { status: "error", message: "Transaction is not in a deleted state" };

  tSheet.getRange(trRowIndex, 8).setValue(0);
  tSheet.getRange(trRowIndex, 9).setValue("");
  tSheet.getRange(trRowIndex, 10).setValue("");

  const sSheet = getSheet(SHEET_STUDENTS);
  const sValues = sSheet.getDataRange().getValues();
  for (let i = 1; i < sValues.length; i++) {
    if (String(sValues[i][0]) === String(studentNis)) {
      const currentPoints = parseInt(sValues[i][6]) || 0;
      sSheet.getRange(i + 1, 7).setValue(currentPoints + pointChange);
      break;
    }
  }

  writeAudit(
    data.actor || "system",
    "redoTransaction",
    data.tr_id,
    `Redo ${pointChange} points to NIS ${studentNis}`
  );

  return { status: "success" };
}

function handleDeleteTransaction(data) {
  // Hard delete (admin only - keep simple here)
  return handleUndoTransaction(data);
}

function handleGetTransaction(data) {
  if (!data || !data.tr_id) return { status: "error", message: "tr_id is required" };
  const sheet = getSheet(SHEET_TRANSACTIONS);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.tr_id) {
      return {
        status: "success",
        transaction: {
          tr_id: values[i][0],
          date: new Date(values[i][1]),
          teacher_id: values[i][2],
          student_nis: values[i][3],
          violation_id: values[i][4],
          points: parseInt(values[i][5]) || 0,
          note: values[i][6] || "",
          deleted: values[i][7] === 1
        }
      };
    }
  }
  return { status: "error", message: "Transaction not found" };
}

// =====================================================================
// REPORTS
// =====================================================================

function handleGetLeaderboard(data) {
  const sheet = getSheet(SHEET_STUDENTS);
  const values = sheet.getDataRange().getValues();
  values.shift();
  let students = values.map((row) => ({
    nis: row[0],
    nfc_id: row[1] || "",
    name: row[2],
    class: row[3],
    house: row[4],
    photo_url: sanitizePhotoUrl(row[5]),
    points: parseInt(row[6]) || 0
  }));

  if (data) {
    if (data.house) students = students.filter(s => s.house === data.house);
    if (data.grade) students = students.filter(s => String(s.class) === String(data.grade));
    if (data.level === "JHS") students = students.filter(s => [7, 8, 9].includes(parseInt(s.class)));
    if (data.level === "SHS") students = students.filter(s => [10, 11, 12].includes(parseInt(s.class)));
  }

  const sortedDesc = [...students].sort((a, b) => b.points - a.points);

  // Top 3
  const top = sortedDesc.slice(0, 3);

  return {
    status: "success",
    highest: sortedDesc[0] || null,
    lowest: sortedDesc[sortedDesc.length - 1] || null,
    all: sortedDesc,
    top3: top,
    total: sortedDesc.length
  };
}

function handleGetHousePoints() {
  const sheet = getSheet(SHEET_STUDENTS);
  const values = sheet.getDataRange().getValues();
  values.shift();
  const houses = { JJT: 0, Jensud: 0, Munir: 0 };
  const counts = { JJT: 0, Jensud: 0, Munir: 0 };
  values.forEach((row) => {
    const house = row[4];
    if (houses[house] !== undefined) {
      houses[house] += parseInt(row[6]) || 0;
      counts[house] += 1;
    }
  });

  const averages = {};
  Object.keys(houses).forEach(k => {
    averages[k] = counts[k] > 0 ? Math.round((houses[k] / counts[k]) * 10) / 10 : 0;
  });

  // Rank houses
  const ranked = Object.entries(houses).sort((a, b) => b[1] - a[1]);
  return {
    status: "success",
    houses,
    counts,
    averages,
    leader: ranked[0][0],
    ranked: ranked.map(r => ({ house: r[0], points: r[1] }))
  };
}

function handleGetHouseHistory(data) {
  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  const months = data.months || 6;
  const now = new Date();
  const result = {};

  HOUSES.forEach(h => {
    result[h] = [];
  });

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    HOUSES.forEach(h => {
      result[h].push({ month: monthKey, points: 0 });
    });
  }

  const monthMap = {};
  HOUSES.forEach(h => {
    result[h].forEach(m => {
      monthMap[`${h}_${m.month}`] = m;
    });
  });

  tValues.forEach(row => {
    if (row[7] === 1) return; // skip deleted
    const date = new Date(row[1]);
    const house = row[11];
    const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    if (diffMonths >= 0 && diffMonths < months && HOUSES.includes(house)) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const key = `${house}_${monthKey}`;
      if (monthMap[key]) {
        monthMap[key].points += parseInt(row[5]) || 0;
      }
    }
  });

  return { status: "success", history: result };
}

function handleGetHistory(data) {
  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const sSheet = getSheet(SHEET_STUDENTS);
  const sValues = sSheet.getDataRange().getValues();
  const studentMap = {};
  sValues.forEach((row, i) => {
    if (i > 0) {
      studentMap[row[0]] = {
        name: row[2],
        class: row[3],
        house: row[4]
      };
    }
  });

  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  let transactions = tValues
    .filter(row => row[7] !== 1) // skip deleted
    .map((row) => {
      const studentInfo = studentMap[row[3]] || { name: "Unknown", class: "-", house: "-" };
      return {
        tr_id: row[0],
        date: new Date(row[1]),
        student_nis: row[3],
        student_name: studentInfo.name,
        student_class: studentInfo.class,
        student_house: studentInfo.house,
        points: parseInt(row[5]) || 0,
        note: row[6] || ""
      };
    });

  // Apply filters
  if (data.month && data.month !== "all") {
    const monthMap = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const targetMonth = monthMap[data.month];
    if (targetMonth === undefined) {
      return { status: "error", message: `Unknown month: ${data.month}` };
    }
    const targetYear = data.year ? parseInt(data.year) : new Date().getFullYear();
    transactions = transactions.filter(t =>
      t.date.getMonth() === targetMonth && t.date.getFullYear() === targetYear
    );
  }

  if (data.house) {
    transactions = transactions.filter(t => t.student_house === data.house);
  }

  if (data.startDate) {
    const start = new Date(data.startDate);
    transactions = transactions.filter(t => t.date >= start);
  }

  if (data.endDate) {
    const end = new Date(data.endDate);
    end.setHours(23, 59, 59, 999);
    transactions = transactions.filter(t => t.date <= end);
  }

  // Sort
  transactions.sort((a, b) => b.date - a.date);

  // Chart data
  let chartData = new Array(31).fill(0);
  const targetMonth = data.month && data.month !== "all" ? data.month : null;
  transactions.forEach((t) => {
    if (targetMonth) {
      const monthMap = {
        January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
        July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
      };
      const m = monthMap[targetMonth];
      if (m !== undefined && t.date.getMonth() === m) {
        chartData[t.date.getDate() - 1] += Math.abs(t.points);
      }
    }
  });

  // Apply viewType (daily/weekly/monthly)
  let filteredTransactions = transactions;
  if (data.viewType === "daily") {
    const today = new Date().toDateString();
    filteredTransactions = transactions.filter(t => t.date.toDateString() === today);
  } else if (data.viewType === "weekly") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    filteredTransactions = transactions.filter(t => t.date >= weekAgo);
  }

  // Limit
  const limit = parseInt(data.limit) || 100;
  const limitedTransactions = filteredTransactions.slice(0, limit);

  return {
    status: "success",
    transactions: limitedTransactions,
    chartData,
    total: filteredTransactions.length
  };
}

function handleGetDashboardStats() {
  const sSheet = getSheet(SHEET_STUDENTS);
  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const vSheet = getSheet(SHEET_VIOLATIONS);

  const sValues = sSheet.getDataRange().getValues();
  sValues.shift();
  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();
  const vValues = vSheet.getDataRange().getValues();
  vValues.shift();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const todayTx = tValues.filter(t => t[7] !== 1 && new Date(t[1]) >= today);
  const weekTx = tValues.filter(t => t[7] !== 1 && new Date(t[1]) >= weekAgo);

  let positiveToday = 0, negativeToday = 0;
  todayTx.forEach(t => {
    const pts = parseInt(t[5]) || 0;
    if (pts > 0) positiveToday += pts;
    else negativeToday += Math.abs(pts);
  });

  // Top student
  const students = sValues.map(row => ({
    nis: row[0],
    name: row[2],
    points: parseInt(row[6]) || 0
  }));
  const topStudent = students.sort((a, b) => b.points - a.points)[0];

  return {
    status: "success",
    stats: {
      total_students: sValues.length,
      total_violations: vValues.length,
      total_transactions: tValues.filter(t => t[7] !== 1).length,
      transactions_today: todayTx.length,
      transactions_week: weekTx.length,
      positive_today: positiveToday,
      negative_today: negativeToday,
      top_student: topStudent
    }
  };
}

function handleGetClassStats() {
  const sSheet = getSheet(SHEET_STUDENTS);
  const tSheet = getSheet(SHEET_TRANSACTIONS);

  const sValues = sSheet.getDataRange().getValues();
  sValues.shift();
  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  const byClass = {};
  sValues.forEach(row => {
    const cls = row[3];
    if (!byClass[cls]) {
      byClass[cls] = { class: cls, total_students: 0, total_points: 0, students: [] };
    }
    byClass[cls].total_students++;
    byClass[cls].total_points += parseInt(row[6]) || 0;
    byClass[cls].students.push({
      nis: row[0],
      name: row[2],
      points: parseInt(row[6]) || 0
    });
  });

  Object.values(byClass).forEach(c => {
    c.average = c.total_students > 0 ? Math.round((c.total_points / c.total_students) * 10) / 10 : 0;
    c.students.sort((a, b) => b.points - a.points);
    c.top_student = c.students[0];
  });

  const sorted = Object.values(byClass).sort((a, b) => b.total_points - a.total_points);
  return { status: "success", classes: sorted };
}

function handleGetActivityHeatmap(data) {
  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  const days = parseInt(data.days) || 30;
  const result = {};
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result[key] = { date: key, count: 0, points: 0 };
  }

  tValues.forEach(row => {
    if (row[7] === 1) return;
    const date = new Date(row[1]);
    const key = date.toISOString().slice(0, 10);
    if (result[key]) {
      result[key].count++;
      result[key].points += Math.abs(parseInt(row[5]) || 0);
    }
  });

  return { status: "success", heatmap: Object.values(result) };
}

function handleGetAuditLog(data) {
  try {
    const sheet = getSheet(SHEET_AUDIT);
    const values = sheet.getDataRange().getValues();
    values.shift();
    const limit = parseInt(data.limit) || 100;
    const logs = values
      .map(row => ({
        log_id: row[0],
        timestamp: new Date(row[1]),
        actor: row[2],
        action: row[3],
        target: row[4],
        details: row[5]
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
    return { status: "success", logs };
  } catch (e) {
    return { status: "success", logs: [] };
  }
}

function handleGetAnnouncements() {
  try {
    const sheet = getSheet(SHEET_ANNOUNCEMENTS);
    const values = sheet.getDataRange().getValues();
    values.shift();
    const now = new Date();
    const announcements = values
      .filter(row => row[4] === true || row[4] === "TRUE" || row[4] === 1)
      .map(row => ({
        id: row[0],
        title: row[1],
        body: row[2],
        created_at: new Date(row[3]),
        expires_at: row[4] ? new Date(row[4]) : null
      }))
      .filter(a => !a.expires_at || a.expires_at > now);
    return { status: "success", announcements };
  } catch (e) {
    return { status: "success", announcements: [] };
  }
}

// =====================================================================
// EXPORT
// =====================================================================

function handleExportData(data) {
  const tSheet = getSheet(SHEET_TRANSACTIONS);
  const sSheet = getSheet(SHEET_STUDENTS);
  const sValues = sSheet.getDataRange().getValues();
  const studentMap = {};
  sValues.forEach((row, i) => {
    if (i > 0) studentMap[row[0]] = { name: row[2], class: row[3], house: row[4] };
  });

  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  let rows = tValues
    .filter(t => data.includeDeleted || t[7] !== 1)
    .map((t) => {
      const sInfo = studentMap[t[3]] || { name: "Unknown", class: "-", house: "-" };
      const rawDate = new Date(t[1]);
      return {
        Date: rawDate.toLocaleString("en-US"),
        Transaction_ID: t[0],
        NIS: t[3],
        Name: sInfo.name,
        Grade: sInfo.class,
        House: sInfo.house,
        Points: t[5],
        Note: t[6] || "",
        Status: t[7] === 1 ? "Deleted" : "Active",
        _rawDate: rawDate
      };
    });

  if (data.startDate) {
    const start = new Date(data.startDate);
    rows = rows.filter(r => new Date(r._rawDate || r.Date) >= start);
  }
  if (data.endDate) {
    const end = new Date(data.endDate);
    end.setHours(23, 59, 59, 999);
    rows = rows.filter(r => new Date(r._rawDate || r.Date) <= end);
  }

  // Strip helper field before returning
  rows = rows.map(r => {
    const { _rawDate, ...rest } = r;
    return rest;
  });

  return { status: "success", data: rows, total: rows.length };
}

// =====================================================================
// STUDENTS REPORT (for student-list export)
// =====================================================================

function handleGetStudentsReport(data) {
  const sheet = getSheet(SHEET_STUDENTS);
  const values = sheet.getDataRange().getValues();
  values.shift();

  let students = values.map((row) => ({
    nis: row[0],
    nfc_id: row[1] || "",
    name: row[2] || "",
    class: row[3],
    house: row[4],
    photo_url: sanitizePhotoUrl(row[5]),
    points: parseInt(row[6]) || 0
  }));

  if (data) {
    if (data.house) students = students.filter(s => s.house === data.house);
    if (data.grade) students = students.filter(s => String(s.class) === String(data.grade));
    if (data.level === "JHS") students = students.filter(s => [7, 8, 9].includes(parseInt(s.class)));
    if (data.level === "SHS") students = students.filter(s => [10, 11, 12].includes(parseInt(s.class)));
  }

  students.sort((a, b) => b.points - a.points);

  return { status: "success", students, total: students.length };
}