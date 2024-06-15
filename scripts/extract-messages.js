#!/usr/bin/env node
import { GettextExtractor, JsExtractors } from 'gettext-extractor'

const extractor = new GettextExtractor()
const comments = {
  sameLineLeading: true,
  otherLineLeading: true,
  sameLineTrailing: true,
  regex: /I10N:\s*(.*)\s*/m,
}

extractor
  .createJsParser([
    JsExtractors.callExpression('gt.gettext', {
      arguments: {
        text: 0,
      },
      comments: comments,
    }),
    JsExtractors.callExpression('gt.pgettext', {
      arguments: {
        context: 0,
        text: 1,
      },
      comments: comments,
    }),
    JsExtractors.callExpression('gt.ngettext', {
      arguments: {
        text: 0,
        textPlural: 1,
      },
      comments: comments,
    }),
  ])
  .parseFilesGlob('./src/**/*.@(ts|js|tsx|jsx)')

extractor.savePotFile('./po/messages.pot')

extractor.printStats()
