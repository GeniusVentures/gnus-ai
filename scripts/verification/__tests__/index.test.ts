/**
 * Basic test to verify the Diamond Verification System loads correctly
 */

import { createVerificationSystem, DiamondVerificationSystem } from '../index';
import { FunctionSelectorVerificationModule } from '../modules/FunctionSelectorModule';
import { DiamondStructureVerificationModule } from '../modules/DiamondStructureModule';
import { expect } from 'chai';

describe('Diamond Verification System', () => {
  test('should create verification system with default modules', () => {
    const system = createVerificationSystem();
    expect(system).to.be.instanceOf(DiamondVerificationSystem);
    
    // Check that modules are registered
    const modules = system.listModules();
    const moduleIds = modules.map(m => m.id);
    expect(moduleIds).to.include('function-selectors');
    expect(moduleIds).to.include('diamond-structure');
  });

  test('should create individual modules', () => {
    const functionSelectorModule = new FunctionSelectorVerificationModule();
    expect(functionSelectorModule.id).to.equal('function-selectors');
    expect(functionSelectorModule.description).to.include('function selector');
    
    const diamondStructureModule = new DiamondStructureVerificationModule();
    expect(diamondStructureModule.id).to.equal('diamond-structure');
    expect(diamondStructureModule.description).to.include('diamond structure');
  });

  test('should handle module registration and unregistration', () => {
    const system = new DiamondVerificationSystem();
    const module = new FunctionSelectorVerificationModule();
    
    // Register module
    system.registerModule(module);
    const modules = system.listModules();
    const moduleIds = modules.map(m => m.id);
    expect(moduleIds).to.contain('function-selectors');

    // Unregister module
    system.unregisterModule('function-selectors');
    const modulesAfter = system.listModules();
    const moduleIdsAfter = modulesAfter.map(m => m.id);
    expect(moduleIdsAfter).to.not.contain('function-selectors');
  });
});
