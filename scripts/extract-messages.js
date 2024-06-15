#!/usr/bin/env node
import { GettextExtractor, JsExtractors } from 'gettext-extractor'

const extractor = new GettextExtractor()

extractor
  .createJsParser([
    JsExtractors.callExpression('gt.gettext', {
      arguments: {
        text: 0,
      },
    }),
    JsExtractors.callExpression('gt.pgettext', {
      arguments: {
        context: 0,
        text: 1,
      },
    }),
  ])
  .parseFilesGlob('./src/**/*.@(ts|js|tsx|jsx)')

extractor.savePotFile('./po/messages.pot')

extractor.printStats()
