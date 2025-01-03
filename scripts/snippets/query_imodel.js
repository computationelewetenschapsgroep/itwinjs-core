"use strict";


const core_backend_1 = await import("@itwin/core-backend");
const core_backend_2 = await import("@itwin/core-bentley");

await core_backend_1.IModelHost.startup({ profileName: "query-imodel" });

const iModel = core_backend_1.StandaloneDb.openFile("/app/test-apps/imodel-from-geojson/data/test.bim", core_backend_2.OpenMode.Readonly);



iModel.withPreparedStatement(`SELECT count(*) FROM bis.Element
  `, (stmt) => {
  console.log(stmt.getValue(0).getInteger());
});

iModel.withPreparedStatement(`SELECT *  FROM bis.Element
`, (stmt) => {
  while (stmt.step() === core_backend_2.DbResult.BE_SQLITE_ROW) {
    console.log(stmt.getRow());
  }
});

iModel.close();