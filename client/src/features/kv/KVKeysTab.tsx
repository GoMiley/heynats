import {
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Key,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { KVEntry } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { useDeleteKVKey, useSetKVKey } from './useKV';

interface KVKeysTabProps {
  bucketName: string;
  keys: KVEntry[];
  keysLoading: boolean;
  keysError: unknown;
  isAddingKey: boolean;
  setIsAddingKey: (adding: boolean) => void;
}

export function KVKeysTab({
  bucketName,
  keys,
  keysLoading,
  keysError,
  isAddingKey,
  setIsAddingKey,
}: KVKeysTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());

  // Ref for focusing on the key input when add form appears
  const keyInputRef = useRef<HTMLInputElement>(null);

  // Focus on key input when add form appears
  useEffect(() => {
    if (isAddingKey && keyInputRef.current) {
      // Small delay to ensure the form is rendered
      const timer = setTimeout(() => {
        keyInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAddingKey]);

  const setKeyMutation = useSetKVKey();
  const deleteKeyMutation = useDeleteKVKey();

  const filteredKeys = keys.filter((entry) =>
    entry.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddKey = () => {
    if (newKey.trim() && bucketName) {
      setKeyMutation.mutate(
        {
          bucketName,
          key: newKey.trim(),
          value: newValue,
        },
        {
          onSuccess: () => {
            setNewKey('');
            setNewValue('');
            setIsAddingKey(false);
          },
        }
      );
    }
  };

  const handleCancelAddKey = () => {
    setIsAddingKey(false);
    setNewKey('');
    setNewValue('');
  };

  const handleEditKey = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (editingKey && bucketName) {
      setKeyMutation.mutate(
        {
          bucketName,
          key: editingKey,
          value: editValue,
        },
        {
          onSuccess: () => {
            setEditingKey(null);
            setEditValue('');
          },
        }
      );
    }
  };

  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const handleDeleteKey = (key: string) => setKeyToDelete(key);

  const toggleValueVisibility = (key: string) => {
    const newVisible = new Set(visibleValues);
    if (newVisible.has(key)) {
      newVisible.delete(key);
    } else {
      newVisible.add(key);
    }
    setVisibleValues(newVisible);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      {/* Add Key Form */}
      {isAddingKey && (
        <div className="bg-card rounded-lg border-2 border-primary/30 shadow-md p-6 transition-all duration-300 ease-in-out">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-primary" />
            Add New Key
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="kv-key"
                className="block text-sm font-medium text-foreground/80 mb-1"
              >
                Key
              </label>
              <Input
                id="kv-key"
                ref={keyInputRef}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Enter key name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newKey.trim()) {
                    handleAddKey();
                  }
                }}
              />
            </div>
            <div>
              <label
                htmlFor="kv-value"
                className="block text-sm font-medium text-foreground/80 mb-1"
              >
                Value
              </label>
              <Input
                id="kv-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter value"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newKey.trim()) {
                    handleAddKey();
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={handleCancelAddKey}>
              Cancel
            </Button>
            <Button
              onClick={handleAddKey}
              disabled={!newKey.trim() || setKeyMutation.isPending}
            >
              {setKeyMutation.isPending ? 'Adding...' : 'Add Key'}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search keys..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Keys List */}
      {keysLoading ? (
        <div className="bg-card rounded-lg border border-border p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading keys...</p>
          </div>
        </div>
      ) : keysError ? (
        <div className="bg-card rounded-lg border border-border p-8">
          <div className="text-center">
            <p className="text-destructive">Error loading keys</p>
          </div>
        </div>
      ) : filteredKeys.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8">
          <div className="text-center">
            <Key className="mx-auto h-16 w-16 text-muted-foreground/70 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {keys.length === 0
                ? 'No Keys Found'
                : 'No Keys Match Your Search'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {keys.length === 0
                ? 'Add your first key-value pair to get started.'
                : 'Try adjusting your search term.'}
            </p>
            {keys.length === 0 && (
              <Button onClick={() => setIsAddingKey(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Key
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-3 border-b border-border bg-muted">
            <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground">
              <div>Key</div>
              <div>Value</div>
              <div>Created At</div>
              <div>Revision</div>
              <div>Actions</div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {filteredKeys.map((entry) => (
              <div key={entry.key} className="px-6 py-4">
                <div className="grid grid-cols-5 gap-4 items-center">
                  <div className="flex items-center space-x-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {entry.key}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(entry.key)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>

                  <div>
                    {editingKey === entry.key ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="text-sm"
                      />
                    ) : (
                      <div className="flex items-center space-x-2">
                        {visibleValues.has(entry.key) ? (
                          <code className="text-sm bg-muted px-2 py-1 rounded max-w-xs truncate">
                            {entry.value}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            ••••••••
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleValueVisibility(entry.key)}
                          className="h-6 w-6 p-0"
                        >
                          {visibleValues.has(entry.key) ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entry.created}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    #{entry.revision}
                  </div>

                  <div className="flex items-center space-x-2">
                    {serverConfig.readOnly ? null : editingKey === entry.key ? (
                      <>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={setKeyMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingKey(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditKey(entry.key, entry.value)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteKey(entry.key)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          disabled={deleteKeyMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={keyToDelete !== null}
        onOpenChange={(open) => !open && setKeyToDelete(null)}
        title="Delete key?"
        description={
          <>
            Key <strong>{keyToDelete}</strong> and its history will be
            permanently deleted from <strong>{bucketName}</strong>.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          keyToDelete &&
          deleteKeyMutation.mutate({ bucketName, key: keyToDelete })
        }
      />
    </>
  );
}
