"use strict";

const path = await import("path");


const core_backend_1 = await import("@itwin/core-backend");
const core_backend_2 = await import("@itwin/core-bentley");

await core_backend_1.IModelHost.startup({ profileName: "query-imodel" });

const iModel = core_backend_1.StandaloneDb.openFile("/app/imodels/offshore.bim", core_backend_2.OpenMode.ReadWrite);

const physicalModelId = core_backend_1.PhysicalModel.insert(iModel, core_backend_1.IModelDb.rootSubjectId, "Offshore Energy Project Model")



//console.log(iModel)


await iModel.importSchemas([path.join("/app/imodels/", "Monopile.ecschema.xml")]);

iModel.saveChanges();



iModel.withPreparedStatement(`SELECT * FROM OffshoreEnergy.monopile
  `, (stmt) => {
  while (stmt.step() === core_backend_2.DbResult.BE_SQLITE_ROW) {
    console.log(stmt.getRow());
  }
});

iModel.close();