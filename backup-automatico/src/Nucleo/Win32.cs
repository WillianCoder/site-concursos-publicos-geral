using System;
using System.Runtime.InteropServices;

namespace BackupAutomatico.Nucleo
{
    /// <summary>Funções do Windows usadas para listar e copiar arquivos rapidamente.</summary>
    internal static class Win32
    {
        public const uint FILE_ATTRIBUTE_DIRECTORY = 0x10;
        public const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x400;
        public const uint IO_REPARSE_TAG_MOUNT_POINT = 0xA0000003;
        public const uint IO_REPARSE_TAG_SYMLINK = 0xA000000C;
        public const int FIND_FIRST_EX_LARGE_FETCH = 2;
        public const int FindExInfoBasic = 1;
        public const int FindExSearchNameMatch = 0;
        public const int ERROR_FILE_NOT_FOUND = 2;
        public const int ERROR_NO_MORE_FILES = 18;
        public const int ERROR_REQUEST_ABORTED = 1235;
        public const uint COPY_FILE_ALLOW_DECRYPTED_DESTINATION = 0x8;
        public const uint MOVEFILE_REPLACE_EXISTING = 0x1;
        public const uint MOVEFILE_COPY_ALLOWED = 0x2;
        public const uint PROGRESS_CONTINUE = 0;
        public const uint PROGRESS_CANCEL = 1;
        public static readonly IntPtr INVALID_HANDLE_VALUE = new IntPtr(-1);

        [StructLayout(LayoutKind.Sequential)]
        public struct FILETIME
        {
            public uint Low;
            public uint High;
            public long Ticks => ((long)High << 32) | Low;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct WIN32_FIND_DATA
        {
            public uint dwFileAttributes;
            public FILETIME ftCreationTime;
            public FILETIME ftLastAccessTime;
            public FILETIME ftLastWriteTime;
            public uint nFileSizeHigh;
            public uint nFileSizeLow;
            public uint dwReserved0;
            public uint dwReserved1;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
            public string cFileName;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 14)]
            public string cAlternateFileName;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern IntPtr FindFirstFileExW(string lpFileName, int fInfoLevelId, out WIN32_FIND_DATA lpFindFileData,
            int fSearchOp, IntPtr lpSearchFilter, int dwAdditionalFlags);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool FindNextFileW(IntPtr hFindFile, out WIN32_FIND_DATA lpFindFileData);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool FindClose(IntPtr hFindFile);

        public delegate uint CopyProgressRoutine(long totalFileSize, long totalBytesTransferred, long streamSize,
            long streamBytesTransferred, uint dwStreamNumber, uint dwCallbackReason, IntPtr hSourceFile,
            IntPtr hDestinationFile, IntPtr lpData);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool CopyFileExW(string lpExistingFileName, string lpNewFileName, CopyProgressRoutine lpProgressRoutine,
            IntPtr lpData, ref int pbCancel, uint dwCopyFlags);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool MoveFileExW(string lpExistingFileName, string lpNewFileName, uint dwFlags);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool SetFileAttributesW(string lpFileName, uint dwFileAttributes);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool DeleteFileW(string lpFileName);
    }
}
