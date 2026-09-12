'use strict';

const {str}=require('../context');

const TYPES=new Set(['marketing_draft']);

async function run(type,c,f,p){
  return{type,status:'applied',result:{title:str(p.title,180),text:str(p.text,6000)}};
}

module.exports={TYPES,run};
