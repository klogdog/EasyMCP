/**
 * Tests for Requirements Scanner
 * 
 * Tests for Python import scanning and requirements.txt generation.
 */

import {
    scanFile,
    scanSource,
    scanDirectory,
    generateRequirementsTxt,
    detectPythonVersion,
    mergeRequirements,
    ScanResult,
} from '../requirements-scanner';

// Mock fs operations
const mockFiles: Record<string, string> = {};
const mockDirs: Record<string, Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>> = {};

jest.mock('fs', () => ({
    readFileSync: (path: string) => {
        if (mockFiles[path]) return mockFiles[path];
        throw new Error(`ENOENT: no such file: ${path}`);
    },
    existsSync: (path: string) => path in mockFiles,
    readdirSync: (path: string, options?: { withFileTypes: boolean }) => {
        if (options?.withFileTypes && mockDirs[path]) {
            return mockDirs[path];
        }
        return [];
    },
    statSync: jest.fn(() => ({
        isDirectory: () => false,
    })),
}));

// ============================================================================
// scanSource Tests
// ============================================================================

describe('scanSource', () => {
    describe('basic import parsing', () => {
        it('should parse simple import statements', () => {
            const source = `
import requests
import json
import os
`;

            const result = scanSource(source);

            expect(result.imports).toHaveLength(3);
            expect(result.requirements).toContain('requests');
            expect(result.stdlibImports).toContain('json');
            expect(result.stdlibImports).toContain('os');
        });

        it('should parse from ... import statements', () => {
            const source = `
from flask import Flask, request
from datetime import datetime
from pandas import DataFrame
`;

            const result = scanSource(source);

            expect(result.requirements).toContain('flask');
            expect(result.requirements).toContain('pandas');
            expect(result.stdlibImports).toContain('datetime');
        });

        it('should parse import with alias', () => {
            const source = `
import numpy as np
import pandas as pd
import json as j
`;

            const result = scanSource(source);

            expect(result.requirements).toContain('numpy');
            expect(result.requirements).toContain('pandas');
            expect(result.stdlibImports).toContain('json');
        });

        it('should parse multi-module imports', () => {
            const source = `
import sys, os, json
from typing import List, Dict, Optional
`;

            const result = scanSource(source);

            expect(result.stdlibImports).toContain('sys');
            expect(result.stdlibImports).toContain('os');
            expect(result.stdlibImports).toContain('json');
            expect(result.stdlibImports).toContain('typing');
        });
    });

    describe('package name mapping', () => {
        it('should map cv2 to opencv-python', () => {
            const source = 'import cv2';
            const result = scanSource(source);
            expect(result.requirements).toContain('opencv-python');
        });

        it('should map PIL to Pillow', () => {
            const source = 'from PIL import Image';
            const result = scanSource(source);
            expect(result.requirements).toContain('Pillow');
        });

        it('should map sklearn to scikit-learn', () => {
            const source = 'from sklearn.model_selection import train_test_split';
            const result = scanSource(source);
            expect(result.requirements).toContain('scikit-learn');
        });

        it('should map yaml to PyYAML', () => {
            const source = 'import yaml';
            const result = scanSource(source);
            expect(result.requirements).toContain('PyYAML');
        });

        it('should map bs4 to beautifulsoup4', () => {
            const source = 'from bs4 import BeautifulSoup';
            const result = scanSource(source);
            expect(result.requirements).toContain('beautifulsoup4');
        });
    });

    describe('stdlib detection', () => {
        it('should identify all common stdlib modules', () => {
            const stdlibModules = [
                'os', 'sys', 'json', 'datetime', 'collections', 'itertools',
                'functools', 'pathlib', 'typing', 're', 'math', 'random',
                'subprocess', 'threading', 'asyncio', 'urllib', 'http',
                'logging', 'unittest', 'tempfile', 'shutil', 'pickle',
            ];

            const source = stdlibModules.map(m => `import ${m}`).join('\n');
            const result = scanSource(source);

            expect(result.requirements).toHaveLength(0);
            expect(result.stdlibImports.length).toBe(stdlibModules.length);
        });
    });

    describe('duplicate handling', () => {
        it('should deduplicate imports', () => {
            const source = `
import requests
import requests
from requests import get
from requests.auth import HTTPBasicAuth
`;

            const result = scanSource(source);

            expect(result.requirements).toHaveLength(1);
            expect(result.requirements).toContain('requests');
        });
    });

    describe('comment and empty line handling', () => {
        it('should ignore comments', () => {
            const source = `
# import fake_module
import requests  # This is requests
# from nonexistent import something
`;

            const result = scanSource(source);

            expect(result.requirements).toEqual(['requests']);
        });

        it('should handle empty lines', () => {
            const source = `

import requests

import flask

`;

            const result = scanSource(source);

            expect(result.requirements).toHaveLength(2);
        });
    });

    describe('options', () => {
        it('should use custom package mappings', () => {
            const source = 'import mylib';

            const result = scanSource(source, {
                packageMappings: { mylib: 'my-custom-lib' },
            });

            expect(result.requirements).toContain('my-custom-lib');
        });

        it('should include version constraints when enabled', () => {
            const source = 'import requests';

            const result = scanSource(source, {
                includeVersions: true,
                versionConstraints: { requests: '>=2.28.0' },
            });

            expect(result.requirements).toContain('requests>=2.28.0');
        });
    });

    describe('unknown imports', () => {
        it('should track unknown imports', () => {
            const source = `
import unknown_package
import another_unknown
import requests
`;

            const result = scanSource(source);

            expect(result.unknownImports).toContain('unknown_package');
            expect(result.unknownImports).toContain('another_unknown');
            expect(result.unknownImports).not.toContain('requests');
        });
    });
});

// ============================================================================
// scanFile Tests
// ============================================================================

describe('scanFile', () => {
    beforeEach(() => {
        Object.keys(mockFiles).forEach(key => delete mockFiles[key]);
    });

    it('should scan a Python file', () => {
        mockFiles['/test/module.py'] = `
import requests
import numpy as np
from flask import Flask
import json
`;

        const result = scanFile('/test/module.py');

        expect(result.requirements).toContain('requests');
        expect(result.requirements).toContain('numpy');
        expect(result.requirements).toContain('flask');
        expect(result.stdlibImports).toContain('json');
    });

    it('should throw for missing file', () => {
        expect(() => scanFile('/nonexistent.py')).toThrow();
    });
});

// ============================================================================
// scanDirectory Tests
// ============================================================================

describe('scanDirectory', () => {
    beforeEach(() => {
        Object.keys(mockFiles).forEach(key => delete mockFiles[key]);
        Object.keys(mockDirs).forEach(key => delete mockDirs[key]);
    });

    // Helper to create mock dir entries
    const mockFile = (name: string) => ({
        name,
        isDirectory: () => false,
        isFile: () => true
    });
    const mockDir = (name: string) => ({
        name,
        isDirectory: () => true,
        isFile: () => false
    });

    it('should scan all Python files in directory', () => {
        mockDirs['/project'] = [
            mockFile('main.py'),
            mockFile('utils.py'),
            mockFile('README.md'),
        ];

        mockFiles['/project/main.py'] = 'import requests';
        mockFiles['/project/utils.py'] = 'import flask';

        const result = scanDirectory('/project');

        expect(result.requirements).toContain('requests');
        expect(result.requirements).toContain('flask');
    });

    it('should skip __pycache__ directories', () => {
        mockDirs['/project'] = [
            mockDir('__pycache__'),
            mockFile('main.py'),
        ];

        mockDirs['/project/__pycache__'] = [
            mockFile('cached.pyc'),
        ];

        mockFiles['/project/main.py'] = 'import requests';

        const result = scanDirectory('/project');

        // Should only have scanned main.py
        expect(result.requirements).toEqual(['requests']);
    });

    it('should skip venv and node_modules', () => {
        mockDirs['/project'] = [
            mockDir('venv'),
            mockDir('node_modules'),
            mockDir('.git'),
            mockDir('src'),
        ];

        mockDirs['/project/src'] = [
            mockFile('app.py'),
        ];

        mockFiles['/project/src/app.py'] = 'import flask';

        const result = scanDirectory('/project');

        expect(result.requirements).toEqual(['flask']);
    });
});

// ============================================================================
// generateRequirementsTxt Tests
// ============================================================================

describe('generateRequirementsTxt', () => {
    it('should generate basic requirements.txt', () => {
        const result: ScanResult = {
            imports: [],
            requirements: ['flask', 'requests', 'numpy'],
            stdlibImports: [],
            unknownImports: [],
        };

        const content = generateRequirementsTxt(result);

        expect(content).toContain('# Auto-generated requirements.txt');
        expect(content).toContain('flask');
        expect(content).toContain('requests');
        expect(content).toContain('numpy');
    });

    it('should include custom header', () => {
        const result: ScanResult = {
            imports: [],
            requirements: ['flask'],
            stdlibImports: [],
            unknownImports: [],
        };

        const content = generateRequirementsTxt(result, {
            header: 'My Custom Header',
        });

        expect(content).toContain('# My Custom Header');
    });

    it('should include unknown import warnings', () => {
        const result: ScanResult = {
            imports: [],
            requirements: ['flask', 'unknown_pkg'],
            stdlibImports: [],
            unknownImports: ['unknown_pkg'],
        };

        const content = generateRequirementsTxt(result, {
            includeComments: true,
        });

        expect(content).toContain('# Note: The following packages may need version verification:');
        expect(content).toContain('#   - unknown_pkg');
    });

    it('should sort requirements alphabetically', () => {
        const result: ScanResult = {
            imports: [],
            requirements: ['zlib-wrapper', 'flask', 'aiohttp'],
            stdlibImports: [],
            unknownImports: [],
        };

        const content = generateRequirementsTxt(result);
        const lines = content.split('\n').filter(l => l && !l.startsWith('#'));

        expect(lines).toEqual(['aiohttp', 'flask', 'zlib-wrapper']);
    });
});

// ============================================================================
// detectPythonVersion Tests
// ============================================================================

describe('detectPythonVersion', () => {
    beforeEach(() => {
        Object.keys(mockFiles).forEach(key => delete mockFiles[key]);
    });

    it('should detect version from pyproject.toml', () => {
        mockFiles['/project/pyproject.toml'] = `
[project]
name = "myproject"
requires-python = ">=3.10"
`;

        const version = detectPythonVersion('/project');

        expect(version).toBe('3.10');
    });

    it('should detect version from setup.py', () => {
        mockFiles['/project/setup.py'] = `
from setuptools import setup

setup(
    name="myproject",
    python_requires=">=3.9",
)
`;

        const version = detectPythonVersion('/project');

        expect(version).toBe('3.9');
    });

    it('should return default version when no config found', () => {
        const version = detectPythonVersion('/empty-project');

        expect(version).toBe('3.10');
    });
});

// ============================================================================
// mergeRequirements Tests
// ============================================================================

describe('mergeRequirements', () => {
    it('should merge existing and scanned requirements', () => {
        const existing = `
# Existing requirements
flask==2.0.0
requests>=2.28.0
`;

        const scanned = ['numpy', 'pandas'];

        const merged = mergeRequirements(existing, scanned);

        expect(merged).toContain('flask==2.0.0');
        expect(merged).toContain('requests>=2.28.0');
        expect(merged).toContain('numpy');
        expect(merged).toContain('pandas');
    });

    it('should preserve existing version constraints', () => {
        const existing = `
flask==2.0.0
`;

        const scanned = ['flask', 'requests'];

        const merged = mergeRequirements(existing, scanned);

        expect(merged).toContain('flask==2.0.0');
        expect(merged).not.toContain('flask\n'); // Should not have duplicate
    });

    it('should sort merged requirements', () => {
        const existing = 'zlib-wrapper\nflask\n';
        const scanned = ['aiohttp'];

        const merged = mergeRequirements(existing, scanned);

        expect(merged[0]).toBe('aiohttp');
        expect(merged[1]).toBe('flask');
        expect(merged[2]).toBe('zlib-wrapper');
    });

    it('should handle comments and special lines', () => {
        const existing = `
# This is a comment
-e git+https://github.com/example/repo.git
flask
`;

        const scanned = ['requests'];

        const merged = mergeRequirements(existing, scanned);

        expect(merged).toContain('flask');
        expect(merged).toContain('requests');
        // Should not include comments or -e lines
        expect(merged).not.toContain('# This is a comment');
    });
});

// ============================================================================
// Real-world Scenario Tests
// ============================================================================

describe('Real-world scenarios', () => {
    beforeEach(() => {
        Object.keys(mockFiles).forEach(key => delete mockFiles[key]);
    });

    it('should handle a typical Flask application', () => {
        const source = `
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import redis
from celery import Celery
import logging
`;

        const result = scanSource(source);

        expect(result.requirements).toContain('flask');
        expect(result.requirements).toContain('flask-cors');
        expect(result.requirements).toContain('flask-sqlalchemy');
        expect(result.requirements).toContain('redis');
        expect(result.requirements).toContain('celery');
        expect(result.stdlibImports).toContain('os');
        expect(result.stdlibImports).toContain('logging');
    });

    it('should handle a data science project', () => {
        const source = `
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import matplotlib.pyplot as plt
import seaborn as sns
import tensorflow as tf
from tensorflow import keras
`;

        const result = scanSource(source);

        expect(result.requirements).toContain('numpy');
        expect(result.requirements).toContain('pandas');
        expect(result.requirements).toContain('scikit-learn');
        expect(result.requirements).toContain('matplotlib');
        expect(result.requirements).toContain('seaborn');
        expect(result.requirements).toContain('tensorflow');
    });

    it('should handle an async web application', () => {
        const source = `
import asyncio
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import aiohttp
from motor.motor_asyncio import AsyncIOMotorClient
`;

        const result = scanSource(source);

        expect(result.requirements).toContain('fastapi');
        expect(result.requirements).toContain('pydantic');
        expect(result.requirements).toContain('httpx');
        expect(result.requirements).toContain('aiohttp');
        expect(result.stdlibImports).toContain('asyncio');
        expect(result.stdlibImports).toContain('typing');
    });
});
