const SPREADSHEET_ID = "MASUKKAN_SPREADSHEET_ID_DISINI"; // Ganti
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok" })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result = {};

    switch (action) {
      case "login":
        result = handleLogin(data);
        break;
      case "getStudents":
        result = handleGetStudents(data.className);
        break;
      case "getViolations":
        result = handleGetViolations(data.type);
        break;
      case "addTransaction":
        result = handleAddTransaction(data);
        break;
      case "undoTransaction":
        result = handleUndoTransaction(data);
        break;
      case "getLeaderboard":
        result = handleGetLeaderboard(data);
        break;
      case "getHistory":
        result = handleGetHistory(data);
        break;
      case "getHousePoints":
        result = handleGetHousePoints();
        break;
      case "parentLogin":
        result = handleParentLogin(data.nis);
        break;
      case "exportData":
        result = handleExportData(data);
        break;
      default:
        result = { status: "error", message: "Action tidak dikenal" };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(name) {
  return ss.getSheetByName(name);
}

function handleLogin(data) {
  const sheet = getSheet("Teachers");
  const values = sheet.getDataRange().getValues();
  values.shift();
  for (let row of values) {
    const [id, username, password, nfc_id, name] = row;
    if (data.username === username && data.password === password)
      return { status: "success", teacher: { id, name } };
    if (data.nfc_id && data.nfc_id === nfc_id)
      return { status: "success", teacher: { id, name } };
  }
  return { status: "error", message: "Login gagal." };
}

function handleGetStudents(className) {
  const sheet = getSheet("Students");
  const values = sheet.getDataRange().getValues();
  values.shift();
  let students = values.map((row) => {
    let photoUrl = row[5] || "";
    // PAKSA KOSONG JIKA BUKAN LINK HTTP
    if (typeof photoUrl !== "string" || !photoUrl.startsWith("http")) {
      photoUrl = "";
    }
    return {
      nis: row[0],
      nfc_id: row[1],
      name: row[2],
      class: row[3],
      house: row[4],
      photo_url: photoUrl,
      points: row[6],
    };
  });
  return { status: "success", students: students };
}

function handleGetViolations(type) {
  const sheet = getSheet("Violations");
  const values = sheet.getDataRange().getValues();
  values.shift();
  let violations = values.map((row) => ({
    id: row[0],
    name: row[1],
    type: row[2],
    point: row[3],
  }));
  return { status: "success", violations: violations };
}

function handleAddTransaction(data) {
  const tSheet = getSheet("Transactions");
  const sSheet = getSheet("Students");
  const sValues = sSheet.getDataRange().getValues();
  let studentRowIndex = -1,
    currentPoints = 0;

  for (let i = 1; i < sValues.length; i++) {
    if (String(sValues[i][0]) === String(data.student_nis)) {
      studentRowIndex = i + 1;
      currentPoints = sValues[i][6];
      break;
    }
  }
  if (studentRowIndex === -1)
    return { status: "error", message: "Siswa tidak ditemukan" };

  const trId = `TR${Date.now()}`;
  const timestamp = new Date();
  tSheet.appendRow([
    trId,
    timestamp,
    data.teacher_id,
    data.student_nis,
    data.violation_id,
    data.point_change,
    data.note || "",
  ]);

  const newPoints = parseInt(currentPoints) + parseInt(data.point_change);
  sSheet.getRange(studentRowIndex, 7).setValue(newPoints);

  return { status: "success", newPoints: newPoints, tr_id: trId };
}

function handleUndoTransaction(data) {
  const tSheet = getSheet("Transactions");
  const sSheet = getSheet("Students");
  const tValues = tSheet.getDataRange().getValues();

  let trRowIndex = -1,
    studentNis = 0,
    pointChange = 0;
  for (let i = 1; i < tValues.length; i++) {
    if (tValues[i][0] === data.tr_id) {
      trRowIndex = i + 1;
      studentNis = tValues[i][3];
      pointChange = tValues[i][5];
      break;
    }
  }
  if (trRowIndex === -1)
    return { status: "error", message: "Transaksi tidak ditemukan" };

  // Hapus baris transaksi
  tSheet.deleteRow(trRowIndex);

  // Kembalikan poin siswa
  const sValues = sSheet.getDataRange().getValues();
  for (let i = 1; i < sValues.length; i++) {
    if (String(sValues[i][0]) === String(studentNis)) {
      const currentPoints = sValues[i][6];
      sSheet
        .getRange(i + 1, 7)
        .setValue(parseInt(currentPoints) - parseInt(pointChange));
      break;
    }
  }
  return { status: "success" };
}

function handleGetLeaderboard(data) {
  const sheet = getSheet("Students");
  const values = sheet.getDataRange().getValues();
  values.shift();
  let students = values.map((row) => ({
    nis: row[0],
    name: row[2],
    class: row[3],
    house: row[4],
    photo_url: row[5] || "",
    points: row[6],
  }));
  const sortedDesc = [...students].sort((a, b) => b.points - a.points);
  return {
    status: "success",
    highest: sortedDesc[0] || null,
    lowest: sortedDesc[sortedDesc.length - 1] || null,
    all: sortedDesc,
  };
}

function handleGetHousePoints() {
  const sheet = getSheet("Students");
  const values = sheet.getDataRange().getValues();
  values.shift();
  const houses = { JJT: 0, Jensud: 0, Munir: 0 };
  values.forEach((row) => {
    const house = row[4];
    if (houses[house] !== undefined) houses[house] += parseInt(row[6]) || 0;
  });
  return { status: "success", houses: houses };
}

function handleGetHistory(data) {
  const tSheet = getSheet("Transactions");
  const sSheet = getSheet("Students");
  const sValues = sSheet.getDataRange().getValues();
  const studentMap = {};
  sValues.forEach((row, i) => {
    if (i > 0) studentMap[row[0]] = { name: row[2], class: row[3] };
  });

  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();
  const monthMap = {
    Januari: 0,
    Februari: 1,
    Maret: 2,
    April: 3,
    Mei: 4,
    Juni: 5,
    Juli: 6,
    Agustus: 7,
    September: 8,
    Oktober: 9,
    November: 10,
    Desember: 11,
  };
  const targetMonth = monthMap[data.month];
  const currentYear = new Date().getFullYear();
  let transactions = [];
  let chartData = new Array(31).fill(0);

  tValues.forEach((row) => {
    const date = new Date(row[1]);
    if (date.getMonth() === targetMonth && date.getFullYear() === currentYear) {
      const studentInfo = studentMap[row[3]] || { name: "Unknown", class: "-" };
      transactions.push({
        date: date,
        student_name: studentInfo.name,
        student_class: studentInfo.class,
        points: parseInt(row[5]),
        note: row[6],
      });
      chartData[date.getDate() - 1] += Math.abs(parseInt(row[5]));
    }
  });

  let filteredTransactions = [];
  const now = new Date();
  if (data.viewType === "daily")
    filteredTransactions = transactions.filter(
      (t) => t.date.toDateString() === now.toDateString()
    );
  else if (data.viewType === "weekly") {
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    filteredTransactions = transactions.filter((t) => t.date >= weekAgo);
  } else filteredTransactions = transactions;

  return {
    status: "success",
    transactions: filteredTransactions.reverse(),
    chartData: chartData,
  };
}

function handleParentLogin(nis) {
  const sSheet = getSheet("Students");
  const tSheet = getSheet("Transactions");
  const sValues = sSheet.getDataRange().getValues();
  let student = null;

  for (let i = 1; i < sValues.length; i++) {
    if (String(sValues[i][0]) === String(nis)) {
      student = {
        nis: sValues[i][0],
        name: sValues[i][2],
        class: sValues[i][3],
        house: sValues[i][4],
        photo_url: sValues[i][5] || "",
        points: sValues[i][6],
      };
      break;
    }
  }
  if (!student) return { status: "error", message: "NIS tidak ditemukan" };

  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();
  const history = tValues
    .filter((t) => String(t[3]) === String(nis))
    .map((t) => ({
      date: new Date(t[1]),
      points: parseInt(t[5]),
      note: t[6] || "",
    }))
    .reverse();

  return { status: "success", student: student, history: history };
}

function handleExportData(data) {
  const tSheet = getSheet("Transactions");
  const sSheet = getSheet("Students");
  const sValues = sSheet.getDataRange().getValues();
  const studentMap = {};
  sValues.forEach((row, i) => {
    if (i > 0) studentMap[row[0]] = { name: row[2], class: row[3] };
  });

  const tValues = tSheet.getDataRange().getValues();
  tValues.shift();

  let exportData = tValues.map((t) => {
    const sInfo = studentMap[t[3]] || { name: "Unknown", class: "-" };
    return {
      Tanggal: new Date(t[1]).toLocaleString("id-ID"),
      NIS: t[3],
      Nama: sInfo.name,
      Kelas: sInfo.class,
      Poin: t[5],
      Catatan: t[6] || "",
    };
  });

  return { status: "success", data: exportData };
}
