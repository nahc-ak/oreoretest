const sql = require("mssql");

const config = {
  user: "dbuser",
  password: "dbpassword",
  server: "localhost",
  database: "oreoreDB",
  options: {
    enableArithAbort: false
  },
  pool: {
    // validate: this._poolValidate.bind(this),
    max: 10,
    min: 10
  }
};

let pool;
let reconnecting = false;

let results = [];

const wait = time => {
  return new Promise(resolve => setTimeout(resolve, time));
};

const init = async () => {
  let connectErr;

  console.log("connecting...");

  do {
    connectErr = null;

    pool = new sql.ConnectionPool(config);
    await pool.connect().catch(err => (connectErr = err));

    if (connectErr) {
      console.error(`connecting error: ${connectErr}`);
      await wait(1000);
    }
  } while (connectErr);

  console.log("connected!!");
};

const query = async queryStr => {
  let request;
  let result;
  let queryErr;

  do {
    console.log(`pendings: ${pool.pool ? pool.pending : null}`);

    while (reconnecting) {
      // console.log("waiting for complete recconecting...");
      await wait(1000);
    }

    queryErr = null;

    request = await pool.request();
    result = await request.query(queryStr).catch(err => (queryErr = err));

    if (queryErr) {
      if (queryErr.code === "ETIMEOUT") {
        // リトライする条件(タイムアウト, operation timed out for an unknown reason, ...)
        console.log("retry occuerred!!");
        await wait(1000); // リトライ待機（すぐにリトライするとサーバ負荷上昇する為）
      } else {
        // 再接続が必要な条件(not the Final state, ...)
        console.log(`queryErr: ${queryErr}`);
        if (!reconnecting) {
          console.log("recconect occuerred!!");
          reconnecting = true;
          await pool.close();
          await init();
          reconnecting = false;
        }
      } // リトライしてはいけない条件（クエリエラーなど）throw queryErr.
    }
  } while (queryErr);

  return result.recordset;
};

const processMessage = async index => {
  const result = await query("select 1");
  console.log(index, JSON.stringify(result));
  results[index] = result;

  // await wait(Math.random() * 10000);
};

const main = async () => {
  await init();

  // 並列処理
  const INIT = 0;
  const MAX = 10000;
  const CONCURRENCY = 100; // 同時実行できる数を定義

  let cnt = INIT;
  let promises = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    let p = new Promise(resolve => {
      (async function loop(index) {
        if (index < MAX) {
          await processMessage(index);
          loop(cnt++);
          return;
        }

        resolve();
      })(cnt++);
    });

    promises.push(p);
  }

  await Promise.all(promises);

  await pool.close();

  console.log(JSON.stringify(results));
  console.log(results.length);
};

main().catch(err => console.error(`main error: ${err}`));
