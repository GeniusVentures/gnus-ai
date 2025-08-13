# GNUS.AI Diamond Verification System

A comprehensive, modular verification system for GNUS.AI ERC-2535 Diamond contracts, providing enterprise-grade validation capabilities with professional reporting.

## Features

- **Modular Architecture**: Plugin-based verification modules for extensibility
- **Multi-Network Support**: Works across Ethereum, Polygon, and other EVM networks
- **Professional CLI**: Command-line interface with multiple verification modes
- **Multiple Report Formats**: Console, JSON, and Markdown output formats
- **Parallel Execution**: Efficient verification with configurable parallel processing
- **Integration Ready**: Leverages existing GNUS.AI infrastructure

## Quick Start

### Basic Verification

```bash
# Verify a diamond on mainnet
npx ts-node cli/verify-diamond.ts run GeniusDiamond ethereum

# Quick verification with specific modules
npx ts-node cli/verify-diamond.ts quick GeniusDiamond sepolia --modules function-selector,diamond-structure

# Generate detailed report
npx ts-node cli/verify-diamond.ts run GeniusDiamond polygon --format markdown --output diamond-report.md
```

### Programmatic Usage

```typescript
import { createVerificationSystem, quickVerify } from './index';

// Quick verification
const result = await quickVerify('GeniusDiamond', 'ethereum', {
  modules: ['function-selector', 'diamond-structure'],
  verbose: true
});

// Advanced usage
const system = createVerificationSystem();
system.registerModule(new CustomVerificationModule());

const diamond = await DiamondConfigLoader.loadDiamondInfo('GeniusDiamond', 'ethereum');
const provider = ProviderFactory.createProvider(diamond.network);
const config = await VerificationConfigManager.createFromFile('verification.json');

const report = await system.runVerification(diamond, provider, config);
```

## Architecture

### Core Components

```bash
scripts/verification/
├── core/                          # Core system components
│   ├── types.ts                  # Type definitions and interfaces
│   ├── BaseVerificationModule.ts # Base class for verification modules
│   ├── DiamondVerificationSystem.ts # Main orchestration engine
│   └── VerificationContext.ts    # Context builders and utilities
├── modules/                       # Verification modules
│   ├── FunctionSelectorModule.ts # Function selector verification
│   └── DiamondStructureModule.ts # Diamond structure validation
├── config/                        # Configuration management
│   └── VerificationConfig.ts     # Configuration loading and merging
├── reports/                       # Report generation system
│   ├── ReportGenerator.ts        # Report coordination
│   └── formatters/               # Output format handlers
├── cli/                          # Command-line interface
│   └── verify-diamond.ts         # Main CLI script
└── index.ts                      # Main exports
```

### Verification Modules

#### Function Selector Module

- Validates function selectors match diamond configuration
- Compares on-chain selectors with expected ABI
- Identifies missing, extra, or conflicting function signatures
- Priority: High (critical for diamond functionality)

#### Diamond Structure Module

- Verifies diamond proxy structure and standard compliance
- Validates facet addresses and function mappings
- Checks for standard diamond facets (DiamondCut, DiamondLoupe, Ownership)
- Tests core diamond functionality
- Priority: High (essential for ERC-2535 compliance)

## Configuration

### Configuration File Format

```json
{
  "networks": {
    "ethereum": {
      "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/API_KEY",
      "explorerUrl": "https://etherscan.io",
      "chainId": 1
    }
  },
  "modules": {
    "function-selector": {
      "enabled": true,
      "failOnMismatch": true,
      "ignoreSelectors": ["0x12345678"]
    },
    "diamond-structure": {
      "enabled": true,
      "requireStandardFacets": true,
      "testFunctionality": true
    }
  },
  "execution": {
    "parallel": true,
    "maxConcurrency": 5,
    "timeout": 300000
  },
  "reporting": {
    "verbose": true,
    "showStackTrace": false,
    "colors": true
  }
}
```

### Environment Variables

```bash
# Network RPC URLs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/API_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/API_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/API_KEY

# Configuration
VERIFICATION_CONFIG_FILE=./verification.json
DEFAULT_TIMEOUT=300000
MAX_CONCURRENCY=5
```

## CLI Commands

### `run` - Full Verification

```bash
verify-diamond run <diamondName> <network> [options]

Options:
  --config <file>        Configuration file path
  --modules <list>       Comma-separated list of modules to run
  --format <type>        Report format: console, json, markdown
  --output <file>        Output file path
  --rpc-url <url>        Custom RPC URL
  --timeout <ms>         Verification timeout
  --parallel             Enable parallel execution
  --dry-run              Validate configuration without running
  --verbose              Enable verbose output
```

### `quick` - Quick Verification

```bash
verify-diamond quick <diamondName> <network> [options]

# Runs essential verification modules with minimal output
```

### `config` - Configuration Management

```bash
verify-diamond config init                    # Create default config
verify-diamond config validate <file>         # Validate config file
verify-diamond config show                    # Show current config
```

### `module` - Module Management

```bash
verify-diamond module list                    # List available modules
verify-diamond module info <name>             # Show module information
```

### `list` - List Available Resources

```bash
verify-diamond list diamonds                  # List available diamonds
verify-diamond list networks                  # List configured networks
```

## Report Formats

### Console Output

- Colorized terminal output with progress indicators
- Hierarchical display of verification results
- Summary statistics and recommendations
- Interactive error details

### JSON Format

```json
{
  "diamond": {
    "name": "GeniusDiamond",
    "address": "0x1234...",
    "network": "ethereum"
  },
  "verification": {
    "status": "success",
    "startTime": "2024-01-01T00:00:00.000Z",
    "endTime": "2024-01-01T00:01:00.000Z",
    "duration": 60000
  },
  "modules": [
    {
      "name": "function-selector",
      "status": "success",
      "issues": [],
      "metrics": {
        "selectorsChecked": 45,
        "selectorsMatched": 45
      }
    }
  ]
}
```

### Markdown Format

- Professional documentation format
- Executive summary with key findings
- Detailed verification results
- Recommendations and next steps
- Ready for documentation systems

## Integration with GNUS.AI Infrastructure

The verification system integrates seamlessly with existing GNUS.AI infrastructure:

- **RPCDiamondDeployer**: Leverages deployment configuration and network settings
- **common.ts**: Uses existing utility functions and patterns
- **Deployment Scripts**: Compatible with existing deployment workflows
- **Type System**: Extends existing TypeScript interfaces

## Development

### Adding Custom Modules

```typescript
import { BaseVerificationModule } from '../core/BaseVerificationModule';

export class CustomVerificationModule extends BaseVerificationModule {
  constructor() {
    super('custom-verification', 'Custom Verification Module', 'medium');
  }

  protected async performVerification(): Promise<void> {
    // Custom verification logic
    this.addFinding({
      severity: 'info',
      category: 'custom',
      title: 'Custom Check',
      description: 'Custom verification completed',
      recommendation: 'No action required'
    });
  }

  async initialize(): Promise<void> {
    // Module initialization
  }

  async cleanup(): Promise<void> {
    // Module cleanup
  }
}
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testNamePattern="FunctionSelector"

# Run with coverage
npm test -- --coverage
```

## Error Handling

The system provides comprehensive error handling:

- **Connection Errors**: Network connectivity and RPC endpoint issues
- **Configuration Errors**: Invalid configuration files or missing parameters
- **Contract Errors**: Diamond contract issues or deployment problems
- **Module Errors**: Individual verification module failures
- **Timeout Errors**: Long-running verification timeouts

All errors include detailed context, recommendations, and troubleshooting information.

## Performance

- **Parallel Execution**: Multiple verification modules run concurrently
- **Connection Pooling**: Efficient RPC connection management
- **Caching**: Smart caching of contract data and ABI information
- **Timeout Management**: Configurable timeouts prevent hanging operations
- **Memory Management**: Efficient memory usage for large diamond contracts

## Security

- **Read-Only Operations**: All verification is read-only, no state changes
- **RPC Security**: Secure handling of RPC endpoints and API keys
- **Input Validation**: Comprehensive validation of all user inputs
- **Error Sanitization**: Sensitive information excluded from error messages

## Support

For issues, questions, or contributions:

1. Check existing documentation and error messages
2. Review configuration files and network connectivity
3. Enable verbose mode for detailed debugging information
4. Contact the GNUS.AI development team

## License

This project is licensed under the MIT License - see the LICENSE file for details.
