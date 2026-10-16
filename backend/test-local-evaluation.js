/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test. */
const assert=require('node:assert/strict'),{summarize}=require('./benchmarks/tailoring/local-metrics');
const base={expectedSpans:['SQLite'],providerCalled:true,providerMs:10,proposal:{type:'highlight'},generated:false,useful:false,providerError:null};
const rows=[{...base,generated:true,useful:true,sourceSafe:true,mappingExact:true},
  {...base,expectedSpans:[],generated:true,sourceSafe:true,mappingExact:true},
  {...base,proposal:null},
  {...base,providerCalled:false,providerMs:0,proposal:null},
  {...base,proposal:null,providerError:'invalid',responseErrorKind:'invalid'},
  {...base,proposal:null,providerError:'timeout',responseErrorKind:'timeout'},
  {...base,reason:'INVALID_PROVIDER_OUTPUT'},
  {...base,generated:true,sourceSafe:true,mappingExact:true}];
const result=summarize(rows);
assert.deepEqual(result.usefulSuggestions,{numerator:1,denominator:7,value:1/7});
assert.deepEqual(result.unnecessaryEdits,{numerator:2,denominator:3,value:2/3});
assert.equal(result.modelAbstentions.numerator,1,'Neither skipped calls nor provider errors are model abstentions');
assert.equal(result.providerCalls,7);assert.equal(result.upstreamSkipped,1);assert.equal(result.invalidResponses,1);assert.equal(result.timeouts,1);
assert.equal(result.downstreamGuardRejections,1);assert.equal(result.noSuggestionOnUsefulCases,5);assert.equal(result.unmetUsefulExpectations,6);
assert.deepEqual(result.generatedSourceSafety,{numerator:3,denominator:3,value:1});
assert.equal(summarize([]).latencyMs.p95,null);assert.equal(summarize([]).usefulSuggestions.value,null);
const noCandidate=summarize([{...base,proposal:null,inferenceRequests:0}]);
assert.equal(noCandidate.noCandidateAbstentions,1);assert.equal(noCandidate.modelAbstentions.numerator,0);assert.equal(noCandidate.inferenceCalls,0);
console.log('Local evaluation metrics passed: usefulness, unnecessary edits, abstention, skips, errors, source safety and empty denominators remain separate.');
