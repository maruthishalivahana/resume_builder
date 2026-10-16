/* eslint-disable @typescript-eslint/no-require-imports -- Standalone evaluation-harness checks. */
const assert=require('node:assert/strict');
const {summarizeUnseen}=require('./benchmarks/tailoring/unseen-metrics');
const base={id:'positive',extracted:true,classification:'STRONG',expectedClassification:'STRONG',relevant:['f:2:2'],retrievedAnchors:['f:2:2'],supportingAnchors:['f:2:2']};
const result=summarizeUnseen([base,{...base,id:'negative',expectedClassification:'MISSING',relevant:[],referencesValid:false},
  {...base,id:'missed',classification:'MISSING',retrievedAnchors:[],supportingAnchors:[]}]);
assert.equal(result.classification.numerator,1);assert.equal(result.classification.denominator,3);
assert.equal(result.falseStrong.numerator,1);assert.equal(result.missedStrong.numerator,1);
assert.equal(result.retrievalPrecision.value,0.5);assert.equal(result.retrievalRecall.value,0.5);
assert.deepEqual(result.missedEvidence,[{id:'missed',anchor:'f:2:2'}]);
assert.equal(result.falseSupportingRecords,1);assert.equal(result.invalidSuggestionReferences,1);
assert.equal(summarizeUnseen([]).classification.value,null);
const data=require('./benchmarks/tailoring/unseen-dataset');
assert.equal(new Set(data.retrieval.map(row=>row.id)).size,20);
for(const row of data.retrieval){assert.equal(row.gold.length,1);assert.ok(row.gold[0].why);assert.ok(Array.isArray(row.gold[0].spans));}
console.log('Unseen evaluation harness: false positives, misses, reference failures, empty denominators and 20 labelled cases passed.');
