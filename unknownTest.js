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

const wait = time => {
  return new Promise(resolve => setTimeout(resolve, time));
};

const main = async () => {
  let pool = new sql.ConnectionPool(config);
  await pool.connect();

  for (let i = 0; i < 10000; i += 1) {
    console.log(`pendings: ${pool.pool ? pool.pending : null}`);

    const request = pool.request();
    request.query("select 1").catch(err => console.error(`${err}`));

    await wait(200);
  }

  await pool.close();
};

main().catch(err => console.error(`main error: ${err}`));
