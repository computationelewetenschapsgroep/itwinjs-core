/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { emptyDirSync, mkdirsSync } from "fs-extra";
import { join } from "path";
import * as azureBlob from "@azure/storage-blob";
import { BlobContainer, CloudSqlite, IModelHost } from "@itwin/core-backend";
import { Guid } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

// spell:ignore imodelid itwinid mkdirs devstoreaccount racwdl

export namespace AzuriteTest {

  export const httpAddr = "127.0.0.1:10000";
  export const storage: CloudSqlite.AccountAccessProps = { accessName: "devstoreaccount1", storageType: `azure?emulator=${httpAddr}&sas=1` };
  const accountSasKey = new azureBlob.StorageSharedKeyCredential(storage.accessName, "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==");
  const pipeline = azureBlob.newPipeline(accountSasKey);
  export const getRootUri = () => `http://${httpAddr}/${storage.accessName}`;
  export const getContainerUri = (id: string) => `${getRootUri()}/${id}`;
  export const createAzClient = (id: string) => new azureBlob.ContainerClient(getContainerUri(id), pipeline);

  export const makeSasToken = async (containerId: string, forWriteAccess: boolean) => {
    const address = { id: containerId, uri: getRootUri() };
    const userToken = forWriteAccess ? service.userToken.readWrite : service.userToken.readOnly;
    const access = await BlobContainer.service!.requestToken({ address, userToken, forWriteAccess });
    return access.token;
  };

  export namespace Sqlite {
    export type TestContainer = CloudSqlite.CloudContainer & { isPublic: boolean };

    export const setSasToken = async (container: CloudSqlite.CloudContainer, requestWriteAccess: boolean) => {
      container.accessToken = await makeSasToken(container.containerId, requestWriteAccess);
    };

    export const createAzContainer = async (container: TestContainer) => {
      const createProps: BlobContainer.CreateNewContainerProps = {
        metadata: {
          application: IModelHost.applicationId,
          description: "CloudSqlite container for tests",
          format: "CloudSqlite",
          blockSize: "64K",
        },
        id: container.containerId ?? Guid.createValue(),
        scope: {
          iTwinId: "itwin-for-tests",
        },
        userToken: service.userToken.admin,
      };

      if (container.isPublic)
        (createProps as any).isPublic = true; // just for tests.

      const containerService = BlobContainer.service!;
      try {
        await containerService.delete({ address: { id: createProps.id!, uri: getRootUri() }, userToken: createProps.userToken });
      } catch (e) {
      }

      const address = await containerService.create(createProps);
      const access = await containerService.requestToken({ address, userToken: createProps.userToken, forWriteAccess: true });
      container.accessToken = access.token;
    };
    export const initializeContainers = async (containers: TestContainer[]) => {
      for (const container of containers) {
        await createAzContainer(container);
        container.initializeContainer({ checksumBlockNames: true });
      }
    };
    export const makeEmptyDir = (name: LocalDirName) => {
      mkdirsSync(name);
      emptyDirSync(name);
    };

    export const makeContainer = (containerId: string, isPublic: boolean): TestContainer => {
      const cont = CloudSqlite.createCloudContainer({ ...storage, containerId, writeable: true, accessToken: "" }) as TestContainer;
      cont.isPublic = isPublic;
      return cont;
    };

    export const makeContainers = (props: [string, boolean][]): TestContainer[] => {
      const containers = [];
      for (const entry of props)
        containers.push(makeContainer(entry[0], entry[1]));

      return containers;
    };
    export const makeCache = (cacheName: string) => {
      const cacheDir = join(IModelHost.cacheDir, cacheName);
      makeEmptyDir(cacheDir);
      return CloudSqlite.CloudCaches.getCache({ cacheName, cacheDir });

    };
    export const makeCaches = (names: string[]) => {
      const caches = [];
      for (const name of names)
        caches.push(makeCache(name));
      return caches;
    };

    export const uploadFile = async (container: CloudSqlite.CloudContainer, cache: CloudSqlite.CloudCache, dbName: string, localFileName: LocalFileName) => {
      expect(container.isConnected).false;
      container.connect(cache);
      expect(container.isConnected);

      await CloudSqlite.withWriteLock("upload", container, async () => CloudSqlite.uploadDb(container, { dbName, localFileName }));
      expect(container.isConnected);
      container.disconnect({ detach: true });
      expect(container.isConnected).false;
    };
  }

  const fakeToken = () => `token ${Guid.createValue()}`;
  export const service = {
    userToken: {
      admin: fakeToken(), // just unique strings
      readOnly: fakeToken(),
      readWrite: fakeToken(),
    },

    create: async (arg: BlobContainer.CreateNewContainerProps & { isPublic?: true }) => {
      if (arg.userToken !== service.userToken.admin)
        throw new Error("only admins may create containers");

      const address: BlobContainer.Address = { id: arg.id ?? Guid.createValue(), uri: getRootUri() };
      const azCont = createAzClient(address.id);
      const opts: azureBlob.ContainerCreateOptions = {
        metadata: {
          itwinid: arg.scope.iTwinId,
          ...arg.metadata,
        },
      };
      if (arg.scope.iModelId)
        opts.metadata!.imodelid = arg.scope.iModelId;
      if (arg.isPublic)
        opts.access = "blob";

      await azCont.create(opts);
      return address;
    },

    delete: async (arg: BlobContainer.AccessContainerProps): Promise<void> => {
      if (arg.userToken !== service.userToken.admin)
        throw new Error("only admins may delete containers");

      await createAzClient(arg.address.id).delete();
    },

    requestToken: async (arg: BlobContainer.RequestTokenProps): Promise<BlobContainer.TokenProps> => {
      switch (arg.userToken) {
        case service.userToken.admin:
        case service.userToken.readWrite:
          break;
        case service.userToken.readOnly:
          if (!arg.forWriteAccess)
            break;
        // eslint-disable-next-line no-fallthrough
        default:
          throw new Error("unauthorized user");
      }
      const azCont = createAzClient(arg.address.id);
      const startsOn = new Date();
      const expiresOn = new Date(startsOn.valueOf() + ((arg.durationSeconds ?? 12 * 60 * 60) * 1000));
      const permissions = azureBlob.ContainerSASPermissions.parse(arg.forWriteAccess ? "racwdl" : "rl");
      const sasUrl = await azCont.generateSasUrl({ permissions, startsOn, expiresOn });
      const contProps = await azCont.getProperties();
      const metadata = contProps.metadata as any;
      if (metadata?.itwinid === undefined)
        throw new Error("invalid container");

      return {
        scope: {
          iTwinId: metadata.itwinid,
          iModelId: metadata.imodelid,
        },
        metadata,
        token: sasUrl.split("?")[1],
        provider: "azure",
        expiration: expiresOn,
      };
    },
  };
  BlobContainer.service = service;
}