import {
  vaccinationDateController,
  saveVaccinationDateController
} from './vaccination-date-controller.js'

export const reportVaccination = {
  plugin: {
    name: 'report-vaccination',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/work-orders/{workOrderSlug}/work-lists/{workListId}/report-vaccination/date',
          ...vaccinationDateController
        },
        {
          method: 'POST',
          path: '/work-orders/{workOrderSlug}/work-lists/{workListId}/report-vaccination/date',
          ...saveVaccinationDateController
        }
      ])
    }
  }
}
