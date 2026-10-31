// ตั้งค่าการเชื่อมต่อ (แก้เฉพาะไฟล์นี้หลังติดตั้งสคริปต์และสร้างที่เก็บบน GitHub)
window.APP_CONFIG = {
  // ลิงก์ Web App ที่ได้จากการ Deploy ใน Apps Script (ลงท้ายด้วย /exec)
  scriptUrl: 'https://script.google.com/macros/s/AKfycbwe7JEUI_TwEC1Zuj7DdXDDk5UorPteBYEloE4K6Y--3jgPV1x961B9NITDuA0cJpOsAg/exec',
  // ที่เก็บ GitHub ที่เก็บเว็บนี้ (ใช้ตอนแอดมินกดเผยแพร่)
  repo: { owner: '', name: '', branch: 'main' },
  // ที่ตั้งไฟล์ข้อมูล
  paths: { settings: 'settings.json', subjects: 'subjects.json', questionsDir: 'q' }
};
