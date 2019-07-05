import * as http from 'http'
import { sendHttpResponse, WacLdpResponse, ResultType } from '../../../../src/lib/api/http/HttpResponder'
import { makeResourceData } from '../../../../src/lib/rdf/ResourceDataUtils'

test('should produce a http response', async () => {
  let responseTask: WacLdpResponse = {
    resultType: ResultType.OkayWithBody,
    resourceData: makeResourceData('content/type', 'bla bla bla'),
    createdLocation: undefined,
    isContainer: false
  }
  const res = {
    writeHead: jest.fn(() => { }), // tslint:disable-line: no-empty
    end: jest.fn(() => { }) // tslint:disable-line: no-empty
  }
  await sendHttpResponse(responseTask, { updatesVia: new URL('wss://localhost:8080/'), storageHost: 'localhost:8080', idpHost: 'localhost:8080' }, res as unknown as http.ServerResponse)
  expect(res.writeHead.mock.calls).toEqual([
    [
      200,
      {
        'Accept-Patch': 'application/sparql-update',
        'Accept-Post': 'application/sparql-update',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Authorization, User, Location, Link, Vary, Last-Modified, ETag, Accept-Patch, Accept-Post, Updates-Via, Allow, WAC-Allow, Content-Length, WWW-Authenticate',
        'Allow': 'GET, HEAD, POST, PUT, DELETE, PATCH',
        'Content-Type': 'content/type',
        'ETag': '"rxrYx2/aLkjqmu0pN+ly6g=="',
        'Link': '<.acl>; rel="acl", <.meta>; rel="describedBy", <http://www.w3.org/ns/ldp#Resource>; rel="type"; <https://localhost:8080>; rel=\"http://openid.net/specs/connect/1.0/issuer\"; <https://localhost:8080/.well-known/solid>; rel=\"service\"',
        'Updates-Via': 'wss://localhost:8080/'
      }
    ]
  ])
  expect(res.end.mock.calls).toEqual([
    [
      'bla bla bla'
    ]
  ])
})
