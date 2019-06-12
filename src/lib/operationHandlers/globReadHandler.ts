import { WacLdpTask, TaskType } from '../api/http/HttpParser'
import { ResultType, WacLdpResponse, ErrorResult } from '../api/http/HttpResponder'

import Debug from 'debug'
import { RdfLayer } from '../rdf/RdfLayer'
import { AccessCheckTask, checkAccess } from '../core/checkAccess'
import { ResourceData, streamToObject } from '../rdf/ResourceDataUtils'
import { mergeRdfSources } from '../rdf/mergeRdfSources'

const debug = Debug('glob-read-handler')

export const globReadHandler = {
  canHandle: (wacLdpTask: WacLdpTask) => {
    return (wacLdpTask.wacLdpTaskType() === TaskType.globRead)
  },
  handle: async function (wacLdpTask: WacLdpTask, aud: string, rdfLayer: RdfLayer, skipWac: boolean): Promise<WacLdpResponse> {
    if (!skipWac) {
      await checkAccess({
        url: wacLdpTask.fullUrl(),
        isContainer: wacLdpTask.isContainer(),
        webId: await wacLdpTask.webId(),
        origin: wacLdpTask.origin(),
        wacLdpTaskType: wacLdpTask.wacLdpTaskType(),
        rdfLayer
      } as AccessCheckTask) // may throw if access is denied
    }

    // At this point will have checked read access over the
    // container, but need to collect all RDF sources, filter on access, and then
    // concatenate them.

    const containerMembers = await rdfLayer.getLocalContainer(wacLdpTask.fullUrl()).getMembers()
    const webId = await wacLdpTask.webId()
    const rdfSources: { [indexer: string]: ResourceData } = {}
    await Promise.all(containerMembers.map(async (member) => {
      debug('glob, considering member', member)
      if (member.isContainer) {// not an RDF source
        return
      }
      const blobUrl = new URL(member.name, wacLdpTask.fullUrl())
      const data = await rdfLayer.getLocalBlob(blobUrl).getData()
      const resourceData = await streamToObject(data)
      if (['text/turtle', 'application/ld+json'].indexOf(resourceData.contentType) === -1) { // not an RDF source
        return
      }
      try {
        if (!skipWac) {
          await checkAccess({
            url: blobUrl,
            isContainer: false,
            webId,
            origin: wacLdpTask.origin(),
            wacLdpTaskType: TaskType.blobRead,
            rdfLayer
          } as AccessCheckTask) // may throw if access is denied
        }
        rdfSources[member.name] = resourceData
        debug('Found RDF source', member.name)
      } catch (error) {
        if (error instanceof ErrorResult && error.resultType === ResultType.AccessDenied) {
          debug('access denied to blob in glob, skipping', blobUrl.toString())
        } else {
          debug('unexpected error for blob in glob, skipping', error.message, blobUrl.toString())
        }
      }
    }))

    return {
      resultType: (wacLdpTask.omitBody() ? ResultType.OkayWithoutBody : ResultType.OkayWithBody),
      resourceData: await mergeRdfSources(rdfSources, wacLdpTask.asJsonLd()),
      createdLocation: undefined,
      isContainer: true
    } as WacLdpResponse
  }
}
