import { vi } from 'vitest'

import hapi from '@hapi/hapi'
import { config } from '#/config/config.js'
import * as createServerImport from '../../server.js'
import * as startServerImport from './start-server.js'
import { statusCodes } from '../constants/status-codes.js'

describe('#startServer', () => {
  let createServerSpy
  let hapiServerSpy
  let originalPort

  beforeAll(() => {
    originalPort = config.get('port')
    config.set('port', 0)
    createServerSpy = vi.spyOn(createServerImport, 'createServer')
    hapiServerSpy = vi.spyOn(hapi, 'server')
  })

  afterAll(() => {
    config.set('port', originalPort)
  })

  describe('When server starts', () => {
    let server

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should start up server as expected', async () => {
      server = await startServerImport.startServer()

      expect(createServerSpy).toHaveBeenCalled()
      expect(hapiServerSpy).toHaveBeenCalled()

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({ message: 'success' })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('When server start fails', () => {
    test('Should log failed startup message', async () => {
      createServerSpy.mockRejectedValue(new Error('Server failed to start'))

      await expect(startServerImport.startServer()).rejects.toThrow(
        'Server failed to start'
      )
    })
  })
})
