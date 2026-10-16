function rate(numerator, denominator) { return {numerator,denominator,value:denominator ? numerator/denominator : null}; }
function summarize(rows) {
  const count = predicate => rows.filter(predicate).length;
  const latencies = rows.filter(row=>row.providerCalled && row.inferenceRequests !== 0).map(row=>row.providerMs).sort((a,b)=>a-b);
  const percentile = fraction => latencies.length ? latencies[Math.ceil(fraction*latencies.length)-1] : null;
  const desired=count(row=>row.expectedSpans.length>0), noEdit=rows.length-desired;
  const generated=count(row=>row.generated), called=count(row=>row.providerCalled);
  return {
    requirements:rows.length,providerCalls:called,upstreamSkipped:rows.length-called,
    usefulSuggestions:rate(count(row=>row.useful),desired),
    validatedSuggestionUsefulness:rate(count(row=>row.useful),generated),
    unnecessaryEdits:rate(count(row=>row.generated && !row.useful),generated),
    unexpectedNoEditSuggestions:rate(count(row=>row.generated && !row.expectedSpans.length),noEdit),
    inferenceCalls:count(row=>row.providerCalled && row.inferenceRequests !== 0),
    noCandidateAbstentions:count(row=>row.providerCalled && row.inferenceRequests === 0 && row.proposal === null && !row.providerError),
    modelAbstentions:rate(count(row=>row.providerCalled && row.inferenceRequests !== 0 && row.proposal === null && !row.providerError),count(row=>row.providerCalled && row.inferenceRequests !== 0)),
    noSuggestionOnUsefulCases:count(row=>row.expectedSpans.length>0 && !row.generated),
    unmetUsefulExpectations:count(row=>row.expectedSpans.length>0 && !row.useful),
    invalidResponses:count(row=>row.responseErrorKind === 'invalid'),
    timeouts:count(row=>row.responseErrorKind === 'timeout'),
    contextLimitFailures:count(row=>row.responseErrorKind === 'context'),
    otherProviderFailures:count(row=>row.responseErrorKind === 'other'),
    downstreamGuardRejections:count(row=>row.reason === 'INVALID_PROVIDER_OUTPUT'),
    unsupportedClaimsRejected:count(row=>row.reason === 'CLAIM_VALIDATION_FAILED'),
    generatedSourceSafety:rate(count(row=>row.generated && row.sourceSafe),generated),
    exactSourceMappings:rate(count(row=>row.generated && row.mappingExact),generated),
    latencyMs:{sampleCount:latencies.length,p50:percentile(0.5),p95:percentile(0.95),max:latencies.at(-1) ?? null},
  };
}
module.exports={summarize};
