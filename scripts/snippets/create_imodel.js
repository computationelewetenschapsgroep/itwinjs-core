"use strict";
const core_backend_1 = await import("@itwin/core-backend");


await core_backend_1.IModelHost.startup({ profileName: "create-imodel" });
if (!core_backend_1.IModelJsFs.existsSync("/app/imodels"))
  core_backend_1.IModelJsFs.mkdirSync("/app/imodels");
const iModel = core_backend_1.StandaloneDb.createEmpty("/app/imodels/empty.bim", { rootSubject: { name: "robot" } })
iModel.saveChanges();
iModel.close();
